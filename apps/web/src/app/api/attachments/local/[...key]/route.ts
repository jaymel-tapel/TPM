import { getSession } from "@/lib/auth";
import { loadEditableTask } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, usingR2, writeLocalObject } from "@/lib/storage";

/**
 * The local driver's stand-in for a presigned PUT. It exists so development
 * and CI exercise the same client code that talks to R2 in production; with
 * R2 configured it refuses, so there is never a second way in.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (usingR2()) return new Response("Not found", { status: 404 });

  const session = await getSession();
  if (!session) return new Response("Not found", { status: 404 });
  const user = session.user;

  const { key: segments } = await params;
  const key = segments.join("/");

  // Keys are `tasks/<taskId>/<uuid>`; anything else was not minted by us.
  const [prefix, taskId] = segments;
  if (prefix !== "tasks" || !taskId || segments.length !== 3) {
    return new Response("Bad key", { status: 400 });
  }
  await loadEditableTask(user, taskId);

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return new Response("Too large", { status: 413 });
  }

  await writeLocalObject(key, body);
  return new Response(null, { status: 200 });
}
