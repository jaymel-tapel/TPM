"use server";

import { TZDate } from "@date-fns/tz";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { taskSchedule } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadViewableTask } from "@/lib/permissions";
import { dayRange, fmt, now, zoneOf } from "@/lib/date";
import {
  DEFAULT_BLOCK,
  SLOT_MINUTES,
  atMinutes,
  clampBlock,
  minutesFromMidnight,
  nextFreeSlot,
  snapToSlot,
  withinPlanHorizon,
  workHoursOf,
} from "@/lib/plan";
import { getDayPlan } from "@/queries/schedule";

export type PlanState = { error?: string } | null;

const planInput = z.object({
  taskId: z.string().uuid(),
  /** `yyyy-MM-dd`. A day, not an instant — see below. */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Minutes past midnight, on the clock, in the planner's own zone. */
  startMinutes: z.coerce.number().int().min(0).max(24 * 60 - SLOT_MINUTES),
  minutes: z.coerce.number().int().optional(),
});

/**
 * Give a task a place in your day.
 *
 * Planning needs only *view* access, the same departure `addComment` makes and
 * for the same reason: deciding when you will look at something is not editing
 * it. A director blocking an hour to review a team member's task should not
 * need the right to change that task.
 *
 * The day being planned is always the caller's own — `userId` comes from the
 * session and is never read from the form. There is no version of this where
 * one person fills in another's afternoon.
 */
export async function planTask(formData: FormData): Promise<PlanState> {
  const parsed = planInput.safeParse({
    taskId: formData.get("taskId"),
    day: formData.get("day"),
    startMinutes: formData.get("startMinutes"),
    minutes: formData.get("minutes") ?? undefined,
  });
  if (!parsed.success) return { error: "That could not be scheduled." };

  const user = await requireUser();
  const task = await loadViewableTask(user, parsed.data.taskId);

  /*
   * The browser sends a day and a time on the clock; the instant is built
   * here, in this person's zone.
   *
   * It cannot be built in the browser: that would need the zone, and adding
   * minutes to midnight lands an hour wrong on the day the clocks change — a
   * London Sunday in October runs twenty-five hours.
   */
  const zone = zoneOf(user);
  const startsAt = snapToSlot(
    atMinutes(dayFrom(parsed.data.day, zone), parsed.data.startMinutes, zone),
  );
  /*
   * Inside the window the strip offers.
   *
   * The first version of this compared `startsAt` against `dayRange(startsAt)`
   * — the day derived from the very value being checked — so it could never
   * fail. A hand-written payload could file a block in 2031, where nothing
   * would ever show it and nothing would ever clear it.
   */
  if (!withinPlanHorizon(startsAt, now(zone), zone)) {
    return { error: "That day is too far off to plan." };
  }

  const minutes = clampBlock(parsed.data.minutes ?? task.estimateMinutes ?? DEFAULT_BLOCK);

  await db
    .insert(taskSchedule)
    .values({ taskId: task.id, userId: user.id, startsAt, minutes })
    // One place per task per person, so moving one is the same write as
    // placing it.
    .onConflictDoUpdate({
      target: [taskSchedule.taskId, taskSchedule.userId],
      set: { startsAt, minutes },
    });

  revalidatePath("/today");
  return null;
}

/**
 * The keyboard path. Dragging is an enhancement — the board says so outright —
 * so there has to be a way to plan something without a mouse, and "put it
 * wherever it fits next" is the thing people actually want from a button.
 */
export async function planTaskNext(formData: FormData): Promise<void> {
  const taskId = z.string().uuid().safeParse(formData.get("taskId"));
  const day = z.coerce.date().safeParse(formData.get("day"));
  // No error channel: the id comes from a hidden field this page rendered, and
  // the time is computed rather than typed, so there is nothing a person could
  // get wrong and nothing useful to tell them.
  if (!taskId.success) return;

  const user = await requireUser();
  const task = await loadViewableTask(user, taskId.data);

  const zone = zoneOf(user);
  const reference = now(zone);
  // Whichever day is open, but never a day nobody may plan.
  const on =
    day.success && withinPlanHorizon(day.data, reference, zone) ? day.data : reference;
  const planningToday =
    dayRange(on, zone).start.getTime() === dayRange(reference, zone).start.getTime();

  const minutes = clampBlock(task.estimateMinutes ?? DEFAULT_BLOCK);
  const plan = await getDayPlan(user.id, on, zone);

  const at = nextFreeSlot(
    plan
      .filter((b) => b.taskId !== task.id)
      .map((b) => ({
        startMinutes: minutesFromMidnight(b.startsAt, zone),
        minutes: b.minutes,
      })),
    // On a future day the whole day is ahead of you; only today starts late.
    planningToday ? minutesFromMidnight(reference, zone) : 0,
    minutes,
    workHoursOf(user).startHour,
  );

  const data = new FormData();
  data.set("taskId", task.id);
  data.set("day", fmt(on, "yyyy-MM-dd", zone));
  data.set("startMinutes", String(at));
  data.set("minutes", String(minutes));
  await planTask(data);
}

export async function unplanTask(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const user = await requireUser();

  // The owner is in the WHERE clause: you can only ever clear your own day, and
  // a foreign id reports nothing either way.
  await db
    .delete(taskSchedule)
    .where(and(eq(taskSchedule.taskId, taskId), eq(taskSchedule.userId, user.id)));

  revalidatePath("/today");
}

/**
 * A `yyyy-MM-dd` back into that day, in this person's zone.
 *
 * Parsed as local noon rather than midnight: midnight is the one moment a
 * daylight-saving transition can erase, and a date that does not exist comes
 * back as the day before.
 */
function dayFrom(day: string, zone: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new TZDate(y, m - 1, d, 12, 0, 0, 0, zone);
}
