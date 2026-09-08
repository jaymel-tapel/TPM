"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isEmptyDocument } from "@meridian/ui/editor";
import { db } from "@/db";
import { taskActivity } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isDirector, loadViewableTask } from "@/lib/permissions";

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
  await loadViewableTask(user, taskId);

  await db.insert(taskActivity).values({
    taskId,
    actorId: user.id,
    kind: "comment",
    body,
  });

  /*
   * Deliberately NOT calling `syncMentionedDocs`. It owns the whole
   * `mentioned` partition for a task — it deletes every row and rebuilds from
   * the body it is handed — so passing a comment would wipe every document the
   * *description* references. The `mentioned` link belongs to the description;
   * a mention in a comment renders as a chip and links to the doc, which is
   * all it needs to do.
   */

  revalidatePath(`/tasks/${taskId}`);
  return null;
}

/**
 * Its author, or a director. Events are not deletable at all — a log you can
 * edit is not a log.
 */
export async function deleteComment(formData: FormData) {
  const id = String(formData.get("activityId") ?? "");
  const user = await requireUser();

  const row = await db.query.taskActivity.findFirst({
    where: eq(taskActivity.id, id),
  });
  if (!row || row.kind !== "comment") notFound();

  await loadViewableTask(user, row.taskId);
  if (row.actorId !== user.id && !isDirector(user)) notFound();

  await db.delete(taskActivity).where(eq(taskActivity.id, id));
  revalidatePath(`/tasks/${row.taskId}`);
}
