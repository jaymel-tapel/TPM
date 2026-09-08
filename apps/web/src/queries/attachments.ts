import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskAttachments, users } from "@/db/schema";

export type Attachment = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedByName: string;
  createdAt: Date;
  href: string;
};

export async function getAttachments(taskId: string): Promise<Attachment[]> {
  const rows = await db
    .select({
      id: taskAttachments.id,
      filename: taskAttachments.filename,
      contentType: taskAttachments.contentType,
      sizeBytes: taskAttachments.sizeBytes,
      uploadedByName: users.name,
      createdAt: taskAttachments.createdAt,
    })
    .from(taskAttachments)
    .innerJoin(users, eq(users.id, taskAttachments.uploadedBy))
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(desc(taskAttachments.createdAt));

  // The bucket is never linked directly — every read goes through the route
  // so it can check the same permission as the task.
  return rows.map((r) => ({ ...r, href: `/api/attachments/${r.id}` }));
}
