"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { and, eq, inArray, sum } from "drizzle-orm";
import { z } from "zod";
import { collectPeople, isEmptyDocument } from "@tpm/ui/editor";
import { db } from "@/db";
import { taskActivity, taskAssignees, tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isDirector, loadViewableTask } from "@/lib/permissions";
import { parseDuration } from "@/lib/duration";
import { deliver, notify } from "@/lib/notify";

export type CommentState = { error?: string } | null;

const commentInput = z.object({
  taskId: z.string().uuid(),
  body: z.string().trim().max(200_000),
});

/**
 * Commenting needs only *view* access, not edit.
 *
 * Every other write in this app goes through `loadEditableTask`, and this is a
 * deliberate departure: saying something about a task is not changing it. A
 * teammate who can see the work should be able to weigh in — that is most of
 * what a feed is for. The task's own fields stay behind `loadEditableTask`.
 */
export async function addComment(
  _prev: CommentState,
  formData: FormData,
): Promise<CommentState> {
  const parsed = commentInput.safeParse({
    taskId: formData.get("taskId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: "That comment could not be posted." };

  const { taskId, body } = parsed.data;
  if (isEmptyDocument(body)) return { error: "Write something first." };

  const user = await requireUser();
  const task = await loadViewableTask(user, taskId);

  const [entry] = await db
    .insert(taskActivity)
    .values({ taskId, actorId: user.id, kind: "comment", body })
    .returning({ id: taskActivity.id });

  /*
   * Deliberately NOT calling `syncMentionedDocs`. It owns the whole
   * `mentioned` partition for a task — it deletes every row and rebuilds from
   * the body it is handed — so passing a comment would wipe every document the
   * *description* references. The `mentioned` link belongs to the description;
   * a mention in a comment renders as a chip and links to the doc, which is
   * all it needs to do.
   *
   * People are different: a mention of a person is addressed *to* them, and
   * has to leave something behind or nobody ever learns it happened.
   */
  const mentioned = collectPeople(body).map((p) => p.userId);
  const told = await notify({
    task,
    actorId: user.id,
    kind: "mentioned",
    activityId: entry!.id,
    userIds: mentioned,
  });

  /*
   * Everyone with a stake in the task hears about a comment — except the
   * people just told they were mentioned. One comment is one notification per
   * person, and "Sarah mentioned you" is the more useful of the two.
   */
  const named = new Set([...mentioned, user.id]);
  const stakeholders = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(eq(taskAssignees.taskId, taskId));
  const alsoTold = await notify({
    task,
    actorId: user.id,
    kind: "commented",
    activityId: entry!.id,
    userIds: [...stakeholders.map((a) => a.userId), task.createdBy].filter(
      (id) => !named.has(id),
    ),
  });

  revalidatePath(`/tasks/${taskId}`);
  await deliver([...told, ...alsoTold]);
  return null;
}

const logInput = z.object({
  taskId: z.string().uuid(),
  spent: z.string().trim().min(1, "How long did it take?"),
  note: z.string().trim().max(200_000).optional().nullable(),
});

/**
 * Time is logged, not typed.
 *
 * An "actual duration" field is a second guess sitting next to the estimate —
 * one number, overwritten, with no record of who spent what or when. Entries
 * are rows on the same stream as everything else, so the task's history says
 * "James logged 2h" in the place you already look to find out what happened.
 *
 * `tasks.actual_minutes` is the sum, recomputed here rather than incremented,
 * so it cannot drift from the rows it summarises.
 */
export async function logTime(_prev: CommentState, formData: FormData): Promise<CommentState> {
  const parsed = logInput.safeParse({
    taskId: formData.get("taskId"),
    spent: formData.get("spent"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the entry." };
  }

  const { taskId, spent, note } = parsed.data;
  const minutes = parseDuration(spent);
  if (minutes === null) return { error: `"${spent}" is not a duration. Try 90m, 3h or 2d 4h.` };
  if (minutes === 0) return { error: "Log some time, or nothing happened." };

  const user = await requireUser();
  await loadViewableTask(user, taskId);

  await db.transaction(async (tx) => {
    await tx.insert(taskActivity).values({
      taskId,
      actorId: user.id,
      kind: "time_logged",
      minutes,
      body: note && !isEmptyDocument(note) ? note : null,
    });
    await syncActualMinutes(tx, taskId);
  });

  revalidatePath("/", "layout");
  return null;
}

/**
 * Recomputed from the rows, never adjusted by a delta — an increment that
 * misses one delete is a total nobody can explain afterwards.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function syncActualMinutes(tx: Tx, taskId: string) {
  const [{ total }] = await tx
    .select({ total: sum(taskActivity.minutes) })
    .from(taskActivity)
    .where(and(eq(taskActivity.taskId, taskId), eq(taskActivity.kind, "time_logged")));

  await tx
    .update(tasks)
    .set({ actualMinutes: total === null ? null : Number(total) })
    .where(eq(tasks.id, taskId));
}

/**
 * Its author, or a director — for a comment or a time entry. The events the
 * system writes for itself are not deletable at all: a log you can edit is
 * not a log.
 */
export async function deleteActivity(formData: FormData) {
  const id = String(formData.get("activityId") ?? "");
  const user = await requireUser();

  const row = await db.query.taskActivity.findFirst({
    where: eq(taskActivity.id, id),
  });
  if (!row || (row.kind !== "comment" && row.kind !== "time_logged")) notFound();

  await loadViewableTask(user, row.taskId);
  if (row.actorId !== user.id && !isDirector(user)) notFound();

  await db.transaction(async (tx) => {
    // The kind is re-asserted in the delete so a forged id cannot reach an
    // event even if the check above were ever loosened.
    await tx
      .delete(taskActivity)
      .where(
        and(
          eq(taskActivity.id, id),
          inArray(taskActivity.kind, ["comment", "time_logged"]),
        ),
      );
    if (row.kind === "time_logged") await syncActualMinutes(tx, row.taskId);
  });

  revalidatePath("/", "layout");
}
