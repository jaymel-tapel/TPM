"use server";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { toPlainText } from "@tpm/ui/editor";
import { db } from "@/db";
import { docVisibilityEnum, documents, folders, taskDocuments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { listAssignableUsers } from "@/queries/accounts";
import type { MentionItem } from "@tpm/ui/editor";
import {
  assertMayPlaceDoc,
  canCreateDocs,
  canViewAccountWork,
  loadEditableFolder,
  loadEditableDoc,
  loadEditableTask,
} from "@/lib/permissions";
import { filterVisibleDocIds, listMentionableFor } from "@/queries/docs";

const docInput = z.object({
  title: z.string().trim().min(1, "Give the document a title").max(200),
  // A BlockNote document, capped the same way a description is: a sanity limit
  // on the JSON, not a word count.
  body: z.string().trim().max(200_000).optional().nullable(),
  visibility: z.enum(docVisibilityEnum.enumValues),
  accountId: z.string().uuid().optional().nullable(),
  folderId: z.string().uuid().optional().nullable(),
});

function parse(formData: FormData) {
  return docInput.safeParse({
    title: formData.get("title"),
    body: formData.get("body") || null,
    visibility: formData.get("visibility"),
    accountId: formData.get("accountId") || null,
    folderId: formData.get("folderId") || null,
  });
}

export type FormState = { error?: string } | null;

function refresh() {
  revalidatePath("/", "layout");
}

/**
 * Where a document sits decides who sees it: a child always carries its root's
 * visibility. Per-document visibility inside a tree makes holes — an account-only
 * child under an org-wide parent is a gap in everyone else's tree and a broken
 * breadcrumb, and the reverse leaks by link.
 */
async function rootPlacement(
  folderId: string | null,
  chosen: { visibility: "org" | "account"; accountId: string | null },
) {
  if (!folderId) return chosen;
  const folder = await db.query.folders.findFirst({ where: eq(folders.id, folderId) });
  if (!folder) return null;
  return { visibility: folder.visibility, accountId: folder.accountId };
}

/** Applies a placement to a folder and everything beneath it. */
async function cascadePlacement(
  folderId: string,
  placement: { visibility: "org" | "account"; accountId: string | null },
) {
  await db.execute(sql`
    with recursive subtree as (
      select id from folders where id = ${folderId}::uuid
      union all
      select c.id from folders c join subtree s on c.parent_id = s.id
    )
    update folders
       set visibility = ${placement.visibility}::doc_visibility,
           account_id = ${placement.accountId}::uuid,
           updated_at = now()
     where id in (select id from subtree)
  `);
  // The documents inside them come along: a document is read by whoever can
  // read the folder it sits in.
  await db.execute(sql`
    with recursive subtree as (
      select id from folders where id = ${folderId}::uuid
      union all
      select c.id from folders c join subtree s on c.parent_id = s.id
    )
    update documents
       set visibility = ${placement.visibility}::doc_visibility,
           account_id = ${placement.accountId}::uuid,
           updated_at = now()
     where folder_id in (select id from subtree)
  `);
}

/** Whether `candidate` sits inside `folderId`'s own subtree. */
async function wouldCycle(folderId: string, candidate: string): Promise<boolean> {
  const result = await db.execute(sql`
    with recursive subtree as (
      select id from folders where id = ${folderId}::uuid
      union all
      select c.id from folders c join subtree s on c.parent_id = s.id
    )
    select 1 from subtree where id = ${candidate}::uuid
  `);
  return result.rows.length > 0;
}

export async function createDoc(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  if (!canCreateDocs(viewer)) notFound();

  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const input = parsed.data;

  const chosen = {
    visibility: input.visibility,
    /*
     * A person on one account still gets the obvious default. On several there
     * is no obvious one, so the form has to say which — and the check below
     * turns that into a sentence rather than a silent guess.
     */
    accountId:
      input.visibility === "org"
        ? null
        : (input.accountId ?? (viewer.accountIds.length === 1 ? viewer.accountIds[0]! : null)),
  };
  const placement = await rootPlacement(input.folderId ?? null, chosen);
  if (!placement) return { error: "That parent document no longer exists." };
  if (placement.visibility === "account" && !placement.accountId) {
    return { error: "Pick the account this document belongs to." };
  }
  await assertMayPlaceDoc(viewer, placement);

  const [doc] = await db
    .insert(documents)
    .values({
      title: input.title,
      body: input.body ?? null,
      // The index reads this, never the JSON — see `documents_search_idx`.
      searchText: toPlainText(input.body),
      visibility: placement.visibility,
      accountId: placement.accountId,
      folderId: input.folderId ?? null,
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

  const nextFolder = input.folderId ?? null;

  const chosen = {
    visibility: input.visibility,
    accountId: input.visibility === "org" ? null : (input.accountId ?? existing.accountId),
  };
  const placement = await rootPlacement(nextFolder, chosen);
  if (!placement) return { error: "That parent document no longer exists." };
  if (placement.visibility === "account" && !placement.accountId) {
    return { error: "Pick the account this document belongs to." };
  }
  await assertMayPlaceDoc(viewer, placement);

  await db
    .update(documents)
    .set({
      title: input.title,
      body: input.body ?? null,
      searchText: toPlainText(input.body),
      folderId: nextFolder,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, docId));

  await db
    .update(documents)
    .set({ visibility: placement.visibility, accountId: placement.accountId })
    .where(eq(documents.id, docId));

  refresh();
  redirect(`/docs/${docId}`);
}

const folderInput = z.object({
  name: z.string().trim().min(1, "Give the folder a name").max(200),
  visibility: z.enum(docVisibilityEnum.enumValues),
  accountId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
});

function parseFolder(formData: FormData) {
  return folderInput.safeParse({
    name: formData.get("name"),
    visibility: formData.get("visibility"),
    accountId: formData.get("accountId") || null,
    parentId: formData.get("parentId") || null,
  });
}

/** A folder's placement, from its parent if it has one. */
async function folderPlacement(
  parentId: string | null,
  chosen: { visibility: "org" | "account"; accountId: string | null },
) {
  if (!parentId) return chosen;
  const parent = await db.query.folders.findFirst({ where: eq(folders.id, parentId) });
  if (!parent) return null;
  return { visibility: parent.visibility, accountId: parent.accountId };
}

export async function createFolder(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  if (!canCreateDocs(viewer)) notFound();

  const parsed = parseFolder(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const input = parsed.data;

  const chosen = {
    visibility: input.visibility,
    /*
     * A person on one account still gets the obvious default. On several there
     * is no obvious one, so the form has to say which — and the check below
     * turns that into a sentence rather than a silent guess.
     */
    accountId:
      input.visibility === "org"
        ? null
        : (input.accountId ?? (viewer.accountIds.length === 1 ? viewer.accountIds[0]! : null)),
  };
  const placement = await folderPlacement(input.parentId ?? null, chosen);
  if (!placement) return { error: "That folder no longer exists." };
  if (placement.visibility === "account" && !placement.accountId) {
    return { error: "Pick the account this folder belongs to." };
  }
  await assertMayPlaceDoc(viewer, placement);

  const [folder] = await db
    .insert(folders)
    .values({
      name: input.name,
      visibility: placement.visibility,
      accountId: placement.accountId,
      parentId: input.parentId ?? null,
      createdBy: viewer.id,
    })
    .returning();

  refresh();
  redirect(`/docs/folders/${folder.id}`);
}

export async function updateFolder(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  const folderId = String(formData.get("folderId") ?? "");
  const existing = await loadEditableFolder(viewer, folderId);

  const parsed = parseFolder(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const input = parsed.data;

  const nextParent = input.parentId ?? null;
  if (nextParent && nextParent !== existing.parentId) {
    if (nextParent === folderId || (await wouldCycle(folderId, nextParent))) {
      return { error: "A folder cannot be filed inside itself." };
    }
  }

  const chosen = {
    visibility: input.visibility,
    accountId: input.visibility === "org" ? null : (input.accountId ?? existing.accountId),
  };
  const placement = await folderPlacement(nextParent, chosen);
  if (!placement) return { error: "That folder no longer exists." };
  if (placement.visibility === "account" && !placement.accountId) {
    return { error: "Pick the account this folder belongs to." };
  }
  await assertMayPlaceDoc(viewer, placement);

  await db
    .update(folders)
    .set({ name: input.name, parentId: nextParent, updatedAt: new Date() })
    .where(eq(folders.id, folderId));

  // Placement last, and down the whole subtree: moving a folder moves what is
  // in it, so nothing is left behind in a scope its folder has left.
  await cascadePlacement(folderId, placement);

  refresh();
  redirect(`/docs/folders/${folderId}`);
}

export async function deleteFolder(formData: FormData) {
  const viewer = await requireUser();
  const folderId = String(formData.get("folderId") ?? "");
  const folder = await loadEditableFolder(viewer, folderId);

  // Everything inside goes with it, by foreign key.
  await db.delete(folders).where(eq(folders.id, folder.id));

  refresh();
  redirect(folder.parentId ? `/docs/folders/${folder.parentId}` : "/docs");
}

export async function deleteDoc(formData: FormData) {
  const viewer = await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const doc = await loadEditableDoc(viewer, docId);

  // Every reference to it goes with it, by foreign key.
  await db.delete(documents).where(eq(documents.id, doc.id));

  refresh();
  redirect(doc.folderId ? `/docs/folders/${doc.folderId}` : "/docs");
}

/** Reference a document from a task, deliberately rather than in passing. */
export async function attachDocToTask(formData: FormData) {
  const viewer = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  await loadEditableTask(viewer, taskId);
  // A document the viewer cannot see is a document they cannot link. Existing
  // is not the same question as visible, and the id came off a form.
  const [visible] = await filterVisibleDocIds(viewer, [documentId]);
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

/**
 * People the `@` menu can offer, alongside documents.
 *
 * Scoped to an account, because a mention is how somebody gets pointed at work,
 * and the work belongs to an account's board. Offering the whole department would
 * let a description name someone who cannot open the thing naming them.
 *
 * `null` means everything the viewer can reach — an org-wide document is read
 * by everyone, so there is no narrower account to scope to.
 */
export async function listMentionablePeople(accountId?: string | null): Promise<MentionItem[]> {
  const viewer = await requireUser();
  // An account the viewer cannot reach is not one they may pick people from.
  if (accountId && !canViewAccountWork(viewer, accountId)) return [];

  const people = await listAssignableUsers(accountId ? [accountId] : undefined);
  return people.map((person) => ({
    id: person.id,
    title: person.name,
    subtitle: person.account_names ?? undefined,
    kind: "person" as const,
  }));
}
