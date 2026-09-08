"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { taskSchedule } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadViewableTask } from "@/lib/permissions";
import { dayRange, now } from "@/lib/date";
import {
  DEFAULT_BLOCK,
  clampBlock,
  minutesFromMidnight,
  nextFreeSlot,
  snapToSlot,
} from "@/lib/plan";
import { getDayPlan } from "@/queries/schedule";

export type PlanState = { error?: string } | null;

const planInput = z.object({
  taskId: z.string().uuid(),
  /** An instant, as the browser's `toISOString()` writes it. */
  startsAt: z.coerce.date(),
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
    startsAt: formData.get("startsAt"),
    minutes: formData.get("minutes") ?? undefined,
  });
  if (!parsed.success) return { error: "That could not be scheduled." };

  const user = await requireUser();
  const task = await loadViewableTask(user, parsed.data.taskId);

  const startsAt = snapToSlot(parsed.data.startsAt);
  /*
   * Inside the day it claims to be on. Without this a hand-written payload
   * could file a block in 2031, where nothing would ever show it and nothing
   * would ever clear it.
   */
  const { start, end } = dayRange(startsAt);
  if (startsAt < start || startsAt >= end) return { error: "That is not a time today." };

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
  // No error channel: the id comes from a hidden field this page rendered, and
  // the time is computed rather than typed, so there is nothing a person could
  // get wrong and nothing useful to tell them.
  if (!taskId.success) return;

  const user = await requireUser();
  const task = await loadViewableTask(user, taskId.data);

  const today = now();
  const minutes = clampBlock(task.estimateMinutes ?? DEFAULT_BLOCK);
  const plan = await getDayPlan(user.id, today);

  const at = nextFreeSlot(
    plan
      .filter((b) => b.taskId !== task.id)
      .map((b) => ({ startMinutes: minutesFromMidnight(b.startsAt), minutes: b.minutes })),
    minutesFromMidnight(today),
    minutes,
  );

  const data = new FormData();
  data.set("taskId", task.id);
  data.set("startsAt", new Date(dayRange(today).start.getTime() + at * 60_000).toISOString());
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
