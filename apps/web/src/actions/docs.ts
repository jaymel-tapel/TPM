"use server";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { toPlainText } from "@meridian/ui/editor";
import { db } from "@/db";
import { docVisibilityEnum, documents, taskDocuments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  assertCanViewTeam,
  canCreateDocs,
  canCreateOrgDocs,
  loadEditableDoc,
  loadEditableTask,
} from "@/lib/permissions";
import { listMentionableFor } from "@/queries/docs";

const docInput = z.object({
  title: z.string().trim().min(1, "Give the document a title").max(200),
  // A BlockNote document, capped the same way a description is: a sanity limit
  // on the JSON, not a word count.
  body: z.string().trim().max(200_000).optional().nullable(),
  visibility: z.enum(docVisibilityEnum.enumValues),
  teamId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
});

function parse(formData: FormData) {
  return docInput.safeParse({
    title: formData.get("title"),
    body: formData.get("body") || null,
    visibility: formData.get("visibility"),
    teamId: formData.get("teamId") || null,
    parentId: formData.get("parentId") || null,
  });
}

export type FormState = { error?: string } | null;

function refresh() {
  revalidatePath("/", "layout");
}

/**
 * Where a document sits decides who sees it: a child always carries its root's
 * visibility. Per-document visibility inside a tree makes holes — a team-only
 * child under an org-wide parent is a gap in everyone else's tree and a broken
 * breadcrumb, and the reverse leaks by link.
 */
async function rootPlacement(
  parentId: string | null,
  chosen: { visibility: "org" | "team"; teamId: string | null },
) {
  if (!parentId) return chosen;
  const parent = await db.query.documents.findFirst({ where: eq(documents.id, parentId) });
  if (!parent) return null;
  return { visibility: parent.visibility, teamId: parent.teamId };
}

/** Applies a placement to a document and everything beneath it. */
async function cascadePlacement(
  docId: string,
  placement: { visibility: "org" | "team"; teamId: string | null },
) {
  await db.execute(sql`
    with recursive subtree as (
      select id from documents where id = ${docId}::uuid
      union all
      select c.id from documents c join subtree s on c.parent_id = s.id
    )
    update documents
       set visibility = ${placement.visibility}::doc_visibility,
           team_id = ${placement.teamId}::uuid,
           updated_at = now()
     where id in (select id from subtree)
  `);
}

/** Whether `candidate` sits inside `docId`'s own subtree. */
async function wouldCycle(docId: string, candidate: string): Promise<boolean> {
  const result = await db.execute(sql`
    with recursive subtree as (
      select id from documents where id = ${docId}::uuid
      union all
      select c.id from documents c join subtree s on c.parent_id = s.id
    )
    select 1 from subtree where id = ${candidate}::uuid
  `);
  return result.rows.length > 0;
}

/**
 * A placement the viewer is actually allowed to make. Org-wide is the Senior
 * Director's alone; a team document belongs to whoever runs that team.
 */
async function assertMayPlace(
  viewer: Awaited<ReturnType<typeof requireUser>>,
  placement: { visibility: "org" | "team"; teamId: string | null },
) {
  if (placement.visibility === "org") {
    if (!canCreateOrgDocs(viewer)) notFound();
    return;
  }
  if (!placement.teamId) notFound();
  await assertCanViewTeam(viewer, placement.teamId);
}

export async function createDoc(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  if (!canCreateDocs(viewer)) notFound();

  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const input = parsed.data;

  const chosen = {
    visibility: input.visibility,
    teamId: input.visibility === "org" ? null : (input.teamId ?? viewer.teamId),
  };
  const placement = await rootPlacement(input.parentId ?? null, chosen);
  if (!placement) return { error: "That parent document no longer exists." };
  if (placement.visibility === "team" && !placement.teamId) {
    return { error: "Pick the team this document belongs to." };
  }
  await assertMayPlace(viewer, placement);

  const [doc] = await db
    .insert(documents)
    .values({
      title: input.title,
      body: input.body ?? null,
      // The index reads this, never the JSON — see `documents_search_idx`.
      searchText: toPlainText(input.body),
      visibility: placement.visibility,
      teamId: placement.teamId,
      parentId: input.parentId ?? null,
      createdBy: viewer.id,
    })
    .returning();

  refresh();
  redirect(`/docs/${doc.id}`);
}

export async function updateDoc(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const existing = await loadEditableDoc(viewer, docId);

  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const input = parsed.data;

  const nextParent = input.parentId ?? null;
  if (nextParent && nextParent !== existing.parentId) {
    if (nextParent === docId || (await wouldCycle(docId, nextParent))) {
      return { error: "A document cannot be filed under itself." };
    }
  }

  const chosen = {
    visibility: input.visibility,
    teamId: input.visibility === "org" ? null : (input.teamId ?? existing.teamId),
  };
  const placement = await rootPlacement(nextParent, chosen);
  if (!placement) return { error: "That parent document no longer exists." };
  if (placement.visibility === "team" && !placement.teamId) {
    return { error: "Pick the team this document belongs to." };
  }
  await assertMayPlace(viewer, placement);

  await db
    .update(documents)
    .set({
      title: input.title,
      body: input.body ?? null,
      searchText: toPlainText(input.body),
      parentId: nextParent,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, docId));

  // Placement last, and down the whole subtree: moving a document moves
  // everything under it, so its children cannot be left behind in a scope
  // their parent has left.
  await cascadePlacement(docId, placement);

  refresh();
  redirect(`/docs/${docId}`);
}

export async function deleteDoc(formData: FormData) {
  const viewer = await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const doc = await loadEditableDoc(viewer, docId);

  // The subtree and every reference to it go with it, by foreign key.
  await db.delete(documents).where(eq(documents.id, doc.id));

  refresh();
  redirect("/docs");
}

/** Reference a document from a task, deliberately rather than in passing. */
export async function attachDocToTask(formData: FormData) {
  const viewer = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  await loadEditableTask(viewer, taskId);
  // A document the viewer cannot see is a document they cannot link.
  const [visible] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.id, documentId));
  if (!visible) notFound();

  await db
    .insert(taskDocuments)
    .values({ taskId, documentId, source: "attached" })
    .onConflictDoNothing();

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/docs/${documentId}`);
}

export async function detachDocFromTask(formData: FormData) {
  const viewer = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  await loadEditableTask(viewer, taskId);

  // Only the attached row. A mention is removed by editing the prose that
  // makes it, which is the only place it exists.
  await db
    .delete(taskDocuments)
    .where(
      and(
        eq(taskDocuments.taskId, taskId),
        eq(taskDocuments.documentId, documentId),
        eq(taskDocuments.source, "attached"),
      ),
    );

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/docs/${documentId}`);
}

/**
 * Everything the `@` picker in a description may offer, scoped to the person
 * typing. Fetched whole and once — the client filters it as they type, because
 * BlockNote asks on every keystroke. See `components/doc-mention.tsx`.
 */
export async function listMentionableDocs() {
  const viewer = await requireUser();
  return listMentionableFor(viewer);
}
