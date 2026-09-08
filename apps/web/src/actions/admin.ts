"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { supportedZones } from "@/lib/zones";
import { department, roleEnum, teams, users } from "@/db/schema";
import { hashPassword, requireUser } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";
import { emailTaken } from "@/queries/admin";

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
  teamId: z.string().uuid().optional().nullable(),
});

function parsePerson(formData: FormData) {
  return personInput.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    teamId: formData.get("teamId") || null,
  });
}

/**
 * The one rule the rest of the product reads off the org chart: a Senior
 * Director sits above the teams and so is on none, and everybody else is on
 * exactly one. Boards, assignment and mentions are all scoped by `team_id`,
 * so a team member without one can reach nothing and a Senior Director with
 * one would quietly narrow their own reach.
 */
function placementError(role: string, teamId: string | null): string | null {
  if (role === "senior_director") {
    return teamId ? "A Senior Director sits above the teams, so they are on none." : null;
  }
  return teamId ? null : "Pick the team they are on.";
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
  const teamId = input.role === "senior_director" ? null : (input.teamId ?? null);

  const placement = placementError(input.role, teamId);
  if (placement) return { error: placement };
  if (await emailTaken(input.email)) {
    return { error: `${input.email} already belongs to somebody.` };
  }

  const password = initialPassword();
  await db.insert(users).values({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(password),
    role: input.role,
    teamId,
  });

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
  const teamId = input.role === "senior_director" ? null : (input.teamId ?? null);

  const placement = placementError(input.role, teamId);
  if (placement) return { error: placement };
  if (await emailTaken(input.email, userId)) {
    return { error: `${input.email} already belongs to somebody.` };
  }

  const existing = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!existing) return { error: "That person no longer exists." };

  // Moving somebody off a team they run leaves the team without a director,
  // rather than pointing at somebody who is no longer on it.
  if (existing.teamId && existing.teamId !== teamId) {
    await db
      .update(teams)
      .set({ accountDirectorId: null })
      .where(sql`${teams.id} = ${existing.teamId}::uuid and ${teams.accountDirectorId} = ${userId}::uuid`);
  }
  // Same if they stop being a director at all.
  if (input.role !== "account_director") {
    await db
      .update(teams)
      .set({ accountDirectorId: null })
      .where(eq(teams.accountDirectorId, userId));
  }

  await db
    .update(users)
    .set({ name: input.name, email: input.email, role: input.role, teamId })
    .where(eq(users.id, userId));

  refresh();
  redirect("/admin");
}

const teamInput = z.object({
  name: z.string().trim().min(1, "Give the team a name").max(120),
  accountDirectorId: z.string().uuid().optional().nullable(),
});

function parseTeam(formData: FormData) {
  return teamInput.safeParse({
    name: formData.get("name"),
    accountDirectorId: formData.get("accountDirectorId") || null,
  });
}

export async function createTeam(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  await assertCanAdminister(viewer);

  const parsed = parseTeam(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  // No director on the way in: there is nobody on the team yet to be one.
  await db.insert(teams).values({ name: parsed.data.name });

  refresh();
  redirect("/admin");
}

export async function updateTeam(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  await assertCanAdminister(viewer);

  const teamId = String(formData.get("teamId") ?? "");
  const parsed = parseTeam(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { name, accountDirectorId } = parsed.data;

  if (accountDirectorId) {
    // A team's director has to be a director, and has to be on that team —
    // `canViewTeam` reads exactly that pairing.
    const director = await db.query.users.findFirst({ where: eq(users.id, accountDirectorId) });
    if (!director || director.teamId !== teamId || director.role !== "account_director") {
      return { error: "A team's director has to be an Account Director on that team." };
    }
  }

  await db
    .update(teams)
    .set({ name, accountDirectorId: accountDirectorId ?? null })
    .where(eq(teams.id, teamId));

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
