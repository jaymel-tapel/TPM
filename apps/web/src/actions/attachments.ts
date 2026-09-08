"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskAttachments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadEditableTask } from "@/lib/permissions";
import { storage } from "@/lib/storage";

/**
 * Uploading is a route rather than an action — it moves bytes, and a route can
 * stream a multipart body and answer with a status code. See
 * `app/api/attachments/upload/route.ts`. Removal is a plain form post, so it
 * stays here.
 */
export async function deleteAttachment(formData: FormData) {
  const id = String(formData.get("attachmentId") ?? "");
  const user = await requireUser();

  const row = await db.query.taskAttachments.findFirst({
    where: eq(taskAttachments.id, id),
  });
  if (!row) return;
  await loadEditableTask(user, row.taskId);

  // The row goes first. If the bucket delete fails the file is unreachable
  // either way, and an orphaned object is cheaper than a broken download.
  await db
    .delete(taskAttachments)
    .where(and(eq(taskAttachments.id, id), eq(taskAttachments.taskId, row.taskId)));
  await storage().remove(row.key).catch(() => {});

  revalidatePath(`/tasks/${row.taskId}`);
}
