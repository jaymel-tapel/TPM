"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { taskAttachments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadEditableTask } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, isAllowedType, keyFor, storage } from "@/lib/storage";

const beginInput = z.object({
  taskId: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export type BeginUpload =
  | { ok: true; key: string; url: string; headers: Record<string, string> }
  | { ok: false; error: string };

/**
 * Step one of an upload: check that this person may edit this task, then hand
 * back a short-lived target for the bytes. The type and size are checked here
 * rather than after the fact, because after the fact the bytes are already in
 * the bucket.
 */
export async function beginUpload(input: {
  taskId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<BeginUpload> {
  const parsed = beginInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That file cannot be uploaded." };

  const { taskId, filename, contentType, sizeBytes } = parsed.data;
  if (!isAllowedType(contentType)) {
    return { ok: false, error: `${contentType} files are not accepted.` };
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Files are limited to 25 MB." };
  }

  const user = await requireUser();
  await loadEditableTask(user, taskId); // 404s if they may not edit it.

  const key = keyFor(taskId, filename);
  const target = await storage().uploadTarget(key, contentType);
  return { ok: true, key, url: target.url, headers: target.headers };
}

const finishInput = beginInput.extend({ key: z.string().min(1).max(400) });

/**
 * Step two: record the file now that the bytes have landed. Splitting it this
 * way means a failed or abandoned upload leaves an orphaned object rather than
 * a row pointing at nothing — the harmless direction of the two.
 */
export async function finishUpload(input: {
  taskId: string;
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}) {
  const parsed = finishInput.safeParse(input);
  if (!parsed.success) throw new Error("Bad attachment");

  const { taskId, key, filename, contentType, sizeBytes } = parsed.data;
  // The key was minted by `beginUpload` for this task; anything else is a
  // client trying to attach someone else's object.
  if (!key.startsWith(`tasks/${taskId}/`)) throw new Error("Bad attachment");

  const user = await requireUser();
  await loadEditableTask(user, taskId);

  const [row] = await db
    .insert(taskAttachments)
    .values({ taskId, key, filename, contentType, sizeBytes, uploadedBy: user.id })
    .onConflictDoUpdate({ target: taskAttachments.key, set: { filename } })
    .returning({ id: taskAttachments.id });

  revalidatePath(`/tasks/${taskId}`);
  // The href, not the bucket URL: an image pasted into a description is read
  // back through the same permission check as any other attachment.
  return { id: row.id, href: `/api/attachments/${row.id}` };
}

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
