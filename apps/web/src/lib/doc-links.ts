import "server-only";
import type { Viewer } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { collectMentions } from "@meridian/ui/editor";
import { db } from "@/db";
import { taskDocuments } from "@/db/schema";
import { filterVisibleDocIds } from "@/queries/docs";

/**
 * Rewrites the documents a task mentions, from the prose that mentions them.
 *
 * A mention lives exactly as long as the sentence around it, so the whole
 * `mentioned` partition is rewritten on every save — the delete-then-insert
 * `linkTags` uses. It never touches an `attached` row, and that is the reason
 * `source` is in the primary key: removing a mention must not delete a link
 * somebody made on purpose, and detaching one must not be quietly undone by
 * prose that still mentions it.
 *
 * The ids come out of a form field, so they are the author's claim about what
 * they linked, not a fact. Only documents the author may actually read become
 * rows — otherwise a hand-written payload could attach another account's document
 * to a task and read its title back off the page.
 */
export async function syncMentionedDocs(
  author: Viewer,
  taskId: string,
  description: string | null,
) {
  const ids = collectMentions(description).map((m) => m.docId);

  await db
    .delete(taskDocuments)
    .where(and(eq(taskDocuments.taskId, taskId), eq(taskDocuments.source, "mentioned")));
  if (ids.length === 0) return;

  const allowed = await filterVisibleDocIds(author, ids);
  if (allowed.length === 0) return;

  await db
    .insert(taskDocuments)
    .values(allowed.map((documentId) => ({ taskId, documentId, source: "mentioned" as const })))
    .onConflictDoNothing();
}
