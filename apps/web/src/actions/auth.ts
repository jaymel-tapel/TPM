"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { roleEnum, users } from "@/db/schema";
import {
  createSession,
  demoSwitcherEnabled,
  destroySession,
  getSession,
  setViewAs,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";

const credentials = z.object({
  email: z.string().trim().toLowerCase().min(3),
  password: z.string().min(1),
});

export async function login(_prev: { error?: string } | null, formData: FormData) {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter an email address and password." };

  const user = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  });
  // Same message either way — don't reveal which addresses exist.
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "That email and password don't match." };
  }

  await createSession(user.id);
  redirect(homeFor(user.role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/**
 * Demo-only: re-point the session at a representative person for the chosen
 * role, so the three levels of the hierarchy can be shown from one login.
 * The brief's named people are preferred where they exist.
 */
const FACES = ["Anna Santos", "Sarah Lim", "Elena Rivera"];

export async function switchViewAs(formData: FormData) {
  if (!demoSwitcherEnabled) throw new Error("Role switching is disabled");
  const session = await getSession();
  if (!session) redirect("/login");

  const role = z.enum(roleEnum.enumValues).parse(formData.get("role"));

  // Switching back to your own role means being yourself again.
  if (role === session.account.role) {
    await setViewAs(null);
    revalidatePath("/", "layout");
    redirect(homeFor(role));
  }

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.role, role))
    .orderBy(sql`case when ${users.name} in ${FACES} then 0 else 1 end`, users.name)
    .limit(1);
  if (!target) throw new Error("No user has that role");

  await setViewAs(target.id);
  revalidatePath("/", "layout");
  redirect(homeFor(target.role));
}
