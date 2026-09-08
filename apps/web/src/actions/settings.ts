"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { supportedZones } from "@/lib/zones";
import { getDepartmentSettings } from "@/queries/department-settings";

export type SettingsState = { error?: string } | null;

const input = z.object({
  timezone: z.string().trim().max(64),
  startHour: z.coerce.number().int().min(0).max(23),
  endHour: z.coerce.number().int().min(1).max(24),
});

/**
 * How this person reckons their day.
 *
 * The timezone is checked against the runtime's own list rather than a regex.
 * An unrecognised name is not a cosmetic error: every page formats dates
 * through `Intl`, so storing one would throw on the next render and leave
 * somebody unable to reach the screen that would let them fix it.
 */
export async function updateDaySettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = input.safeParse({
    timezone: formData.get("timezone"),
    startHour: formData.get("startHour"),
    endHour: formData.get("endHour"),
  });
  if (!parsed.success) return { error: "Check the hours." };

  const { timezone, startHour, endHour } = parsed.data;
  if (endHour <= startHour) return { error: "The day has to end after it starts." };

  // Empty means "follow the department", which is a real choice, not a blank.
  const zone = timezone === "" ? null : timezone;
  if (zone !== null && !supportedZones().includes(zone)) {
    return { error: "That is not a timezone this server knows." };
  }

  const user = await requireUser();
  const dept = await getDepartmentSettings();
  await db
    .update(users)
    .set({
      timezone: zone,
      // Storing the department's own values as null keeps "unset" meaningful:
      // if the default ever moves, these people move with it rather than being
      // frozen at a number that happened to match on the day they saved.
      workStartHour: startHour === dept.workStartHour ? null : startHour,
      workEndHour: endHour === dept.workEndHour ? null : endHour,
    })
    .where(eq(users.id, user.id));

  revalidatePath("/", "layout");
  redirect("/today");
}
