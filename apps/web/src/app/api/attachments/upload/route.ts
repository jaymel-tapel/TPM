import { db } from "@/db";
import { taskAttachments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { canEditTask } from "@/lib/permissions";
import { eq } from "drizzle-orm";
import { tasks } from "@/db/schema";
import { MAX_UPLOAD_BYTES, isAllowedType, keyFor, storage } from "@/lib/storage";

/**
 * One request does the whole upload: permission, validation, bytes, row.
 *
 * The earlier design handed the browser a presigned URL and let it PUT
 * straight at the bucket. That is cheaper on paper, but it is a cross-origin
 * request, so it needs a CORS policy on the bucket before it works at all —
 * and it splits the upload across two round trips, leaving an orphaned object
 * whenever the second one never arrives. Going through the app costs the
 * server the bandwidth and buys back a single transaction that either
 * happened or did not.
 *
 * The trade-off worth knowing: the file crosses this route, so whatever body
 * limit the host imposes now applies. See MAX_UPLOAD_BYTES.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "That upload could not be read." }, { status: 400 });
  }

  const taskId = String(form.get("taskId") ?? "");
  const file = form.get("file");
  if (!(file instanceof File) || !taskId) {
    return Response.json({ error: "Nothing to upload." }, { status: 400 });
  }

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  // Not "forbidden": someone who may not edit the task should not learn it
  // exists either.
  if (!task || !(await canEditTask(session.user, task))) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const contentType = file.type || "application/octet-stream";
  if (!isAllowedType(contentType)) {
    return Response.json({ error: `${contentType} files are not accepted.` }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "Files are limited to 25 MB." }, { status: 413 });
  }
  if (file.size === 0) {
    return Response.json({ error: "That file is empty." }, { status: 400 });
  }

  const body = new Uint8Array(await file.arrayBuffer());
  // The size is re-read from the bytes rather than trusted from the multipart
  // header, which is the client's claim about its own request.
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "Files are limited to 25 MB." }, { status: 413 });
  }

  const key = keyFor(taskId, file.name);
  await storage().put(key, body, contentType);

  const [row] = await db
    .insert(taskAttachments)
    .values({
      taskId,
      key,
      filename: file.name.slice(0, 255),
      contentType,
      sizeBytes: body.byteLength,
      uploadedBy: session.user.id,
    })
    .returning({ id: taskAttachments.id });

  // The app's own href, never the bucket's: an image pasted into a description
  // is read back through the same permission check as any other attachment.
  return Response.json({ id: row.id, href: `/api/attachments/${row.id}` });
}
