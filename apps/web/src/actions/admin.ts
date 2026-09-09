"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { supportedZones } from "@/lib/zones";
import {
  accountMembers,
  boardStatuses,
  boards,
  department,
  roleEnum,
  accounts,
  users,
} from "@/db/schema";

/** The columns an account's work starts out sorted into. */
const DEFAULT_COLUMNS = [
  { name: "To Do", kind: "open" as const, position: 0 },
  { name: "In Progress", kind: "open" as const, position: 1 },
  { name: "Done", kind: "done" as const, position: 2 },
  { name: "Blocked", kind: "blocked" as const, position: 3 },
];
import { hashPassword, requireUser } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";
import { emailTaken } from "@/queries/admin";
import { uuids } from "@/queries/sql";

export type FormState = { error?: string } | null;

/** A created person's first password, shown once and never stored in the clear. */
export type NewPersonState = { error?: string; created?: { name: string; password: string } } | null;

function refresh() {
  revalidatePath("/", "layout");
}

const personInput = z.object({
  name: z.string().trim().min(1, "Give them a name").max(120),
  email: z.string().trim().toLowerCase().email("That is not an email address").max(200),
  role: z.enum(roleEnum.enumValues),
  title: z.string().trim().max(80).optional().nullable(),
  accountIds: z.array(z.string().uuid()),
});

function parsePerson(formData: FormData) {
  return personInput.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    title: formData.get("title") || null,
    // Several checkboxes under one name: a person works on as many accounts as
    // they work on, which is the whole point of the shape.
    accountIds: formData.getAll("accountIds").map(String).filter(Boolean),
  });
}

/**
 * The one rule the rest of the product reads off the org chart: a Senior
 * Director sits above the accounts and so is on none, and everybody else is on
 * at least one. Boards, assignment and mentions are all scoped by `account_id`,
 * so somebody on no account can reach nothing, and a Senior Director on one
 * would quietly narrow their own reach to it.
 *
 * "At least one" is the part that changed. It used to be "exactly one", which
 * is what the whole product has stopped assuming.
 */
function placementError(role: string, accountIds: string[]): string | null {
  if (role === "senior_director") {
    return accountIds.length > 0
      ? "A Senior Director sits above the accounts, so they are on none."
      : null;
  }
  return accountIds.length > 0 ? null : "Pick at least one account they work on.";
}

/** Replaces somebody's memberships wholesale — the form submits the whole set. */
async function setMemberships(userId: string, accountIds: string[]) {
  await db.delete(accountMembers).where(eq(accountMembers.userId, userId));
  if (accountIds.length === 0) return;
  await db
    .insert(accountMembers)
    .values(accountIds.map((accountId) => ({ accountId, userId })))
    .onConflictDoNothing();
}

/**
 * A first password, generated rather than chosen: it is shown to the
 * administrator once, to hand over, and only its hash is ever stored. Nobody
 * types a password into this screen, and none is ever recoverable from it.
 */
function initialPassword() {
  return randomBytes(9).toString("base64url");
}

export async function createPerson(
  _prev: NewPersonState,
  formData: FormData,
): Promise<NewPersonState> {
  const viewer = await requireUser();
  await assertCanAdminister(viewer);

  const parsed = parsePerson(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const input = parsed.data;
  const accountIds = input.role === "senior_director" ? [] : input.accountIds;

  const placement = placementError(input.role, accountIds);
  if (placement) return { error: placement };
  if (await emailTaken(input.email)) {
    return { error: `${input.email} already belongs to somebody.` };
  }

  const password = initialPassword();
  const [created] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(password),
      role: input.role,
      title: input.title ?? null,
    })
    .returning({ id: users.id });
  await setMemberships(created!.id, accountIds);

  refresh();
  // Deliberately no redirect: the password exists only in this response, and
  // a redirect would lose it. It is not in the URL, the database or a log.
  return { created: { name: input.name, password } };
}

/**
 * A new first password, for somebody who has lost theirs.
 *
 * The old one stops working immediately, and so does every session opened with
 * it — `passwordChangedAt` moves forward and tokens issued before it are
 * refused. That includes the administrator's own session if they reset
 * themselves, which is the correct outcome and the reason the form says so.
 */
export async function resetPassword(
  _prev: NewPersonState,
  formData: FormData,
): Promise<NewPersonState> {
  const viewer = await requireUser();
  await assertCanAdminister(viewer);

  const userId = String(formData.get("userId") ?? "");
  const person = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!person) return { error: "That person no longer exists." };

  const password = initialPassword();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), passwordChangedAt: new Date() })
    .where(eq(users.id, userId));

  refresh();
  return { created: { name: person.name, password } };
}

export async function updatePerson(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  await assertCanAdminister(viewer);

  const userId = String(formData.get("userId") ?? "");
  const parsed = parsePerson(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const input = parsed.data;
  const accountIds = input.role === "senior_director" ? [] : input.accountIds;

  const placement = placementError(input.role, accountIds);
  if (placement) return { error: placement };
  if (await emailTaken(input.email, userId)) {
    return { error: `${input.email} already belongs to somebody.` };
  }

  const existing = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!existing) return { error: "That person no longer exists." };

  /*
   * Taking somebody off an account they run leaves that account without a
   * director, rather than pointing at somebody who no longer works on it. With
   * several accounts this is per-account: dropping Sarah from MG clears
   * MG and leaves Volvo and Kia alone.
   */
  await db
    .update(accounts)
    .set({ accountDirectorId: null })
    .where(
      accountIds.length > 0
        ? sql`${accounts.accountDirectorId} = ${userId}::uuid
              and ${accounts.id} not in (${uuids(accountIds)})`
        : eq(accounts.accountDirectorId, userId),
    );
  // Same everywhere, if they stop being a director at all.
  if (input.role !== "account_director") {
    await db
      .update(accounts)
      .set({ accountDirectorId: null })
      .where(eq(accounts.accountDirectorId, userId));
  }

  await db
    .update(users)
    .set({
      name: input.name,
      email: input.email,
      role: input.role,
      title: input.title ?? null,
    })
    .where(eq(users.id, userId));
  await setMemberships(userId, accountIds);

  refresh();
  redirect("/admin");
}

const accountInput = z.object({
  name: z.string().trim().min(1, "Give the account a name").max(120),
  accountDirectorId: z.string().uuid().optional().nullable(),
});

function parseAccount(formData: FormData) {
  return accountInput.safeParse({
    name: formData.get("name"),
    accountDirectorId: formData.get("accountDirectorId") || null,
  });
}

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  await assertCanAdminister(viewer);

  const parsed = parseAccount(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  // No director on the way in: there is nobody on the account yet to be one.
  const [account] = await db
    .insert(accounts)
    .values({ name: parsed.data.name })
    .returning({ id: accounts.id });

  /*
   * Its board, with it. A board is not something anybody creates any more — it
   * is the columns the account's Tasks page is drawn with, and an account
   * without one has a Tasks page that cannot hold anything. Made here so that
   * state never exists.
   */
  const [board] = await db
    .insert(boards)
    .values({ accountId: account!.id, name: "Work", position: 0, createdBy: viewer.id })
    .returning({ id: boards.id });
  await db.insert(boardStatuses).values(
    DEFAULT_COLUMNS.map((column) => ({ ...column, boardId: board!.id })),
  );

  refresh();
  redirect("/admin");
}

export async function updateAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  await assertCanAdminister(viewer);

  const accountId = String(formData.get("accountId") ?? "");
  const parsed = parseAccount(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { name, accountDirectorId } = parsed.data;

  if (accountDirectorId) {
    // An account's director has to be a director, and has to work on that
    // account — `canViewAccount` reads exactly that pairing.
    const director = await db.query.users.findFirst({ where: eq(users.id, accountDirectorId) });
    const member = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.userId, accountDirectorId),
        eq(accountMembers.accountId, accountId),
      ),
    });
    if (!director || !member || director.role !== "account_director") {
      return { error: "An account's director has to be an Account Director on that account." };
    }
  }

  await db
    .update(accounts)
    .set({ name, accountDirectorId: accountDirectorId ?? null })
    .where(eq(accounts.id, accountId));

  refresh();
  redirect("/admin");
}

const departmentInput = z.object({
  timezone: z.string().trim().min(1).max(64),
  startHour: z.coerce.number().int().min(0).max(23),
  endHour: z.coerce.number().int().min(1).max(24),
});

/**
 * The department's defaults: the timezone and working hours everyone falls
 * back to.
 *
 * Moving this moves everybody who has not chosen their own — which is the
 * point of a default rather than a value copied onto each person. It used to
 * be an environment variable, so changing it needed a deploy and nobody in the
 * product could see what it was.
 */
export async function updateDepartment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await requireUser();
  await assertCanAdminister(viewer);

  const parsed = departmentInput.safeParse({
    timezone: formData.get("timezone"),
    startHour: formData.get("startHour"),
    endHour: formData.get("endHour"),
  });
  if (!parsed.success) return { error: "Check the hours." };

  const { timezone, startHour, endHour } = parsed.data;
  if (endHour <= startHour) return { error: "The day has to end after it starts." };
  // Checked against the runtime's own list: an unrecognised name would throw
  // inside `Intl` on every render, for everyone at once.
  if (!supportedZones().includes(timezone)) {
    return { error: "That is not a timezone this server knows." };
  }

  await db
    .insert(department)
    .values({ id: 1, timezone, workStartHour: startHour, workEndHour: endHour })
    .onConflictDoUpdate({
      target: department.id,
      set: { timezone, workStartHour: startHour, workEndHour: endHour, updatedAt: new Date() },
    });

  revalidatePath("/", "layout");
  return null;
}
