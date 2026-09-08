import { eq } from "drizzle-orm";
import { db } from "@/db";
import { taskAttachments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { loadViewableTask } from "@/lib/permissions";
import { dispositionFor, storage } from "@/lib/storage";

/**
 * Every attachment read comes through here so it can be checked against the
 * same permission as the task, and the bytes are streamed rather than
 * redirected to a signed bucket URL: that URL is cross-origin (so a browser
 * will not fetch it without a CORS policy) and it stays valid after the check
 * that produced it. Same reasoning as the upload route.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Not found", { status: 404 });
  const user = session.user;

  const { id } = await params;
  const row = await db.query.taskAttachments.findFirst({
    where: eq(taskAttachments.id, id),
  });
  if (!row) return new Response("Not found", { status: 404 });

  // Throws a Next notFound() when this person may not see the task, which is
  // the right answer: they should not learn the attachment exists.
  await loadViewableTask(user, row.taskId);

  const body = await storage().read(row.key);
  return new Response(body as BodyInit, {
    headers: {
      "content-type": row.contentType,
      "content-length": String(row.sizeBytes),
      // Images come back inline so a description can render them; everything
      // else downloads. These bytes came from a user and this origin holds the
      // viewer's session cookie, so nothing is ever sniffed into being HTML.
      "content-disposition": dispositionFor(row.contentType, row.filename),
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=0, no-store",
    },
  });
}
