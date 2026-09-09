"use server";

import { revalidatePath } from "next/cache";
import { and, asc, count, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { boardStatuses, statusKindEnum, tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { assertCanManageBoard } from "@/lib/permissions";

const name = z.string().trim().min(1, "Give it a name").max(60);

export type BoardFormState = { error?: string } | null;

/**
 * Nobody creates a board any more.
 *
 * An account gets exactly one when the account is made — see `createAccount`
 * in `actions/admin.ts` — and a board is not a place, it is the columns that
 * account's Tasks page is drawn with. Creating, renaming and deleting them
 * were the three verbs that made a board look like a workspace object, and
 * they went with the Boards section.
 *
 * The columns themselves are still an Account Director's to shape, at
 * `/accounts/[id]/columns`. That is the part the brief always allowed: naming
 * the stages a client's work moves through, not building a place to put it.
 */
const columnInput = z.object({
  name,
  kind: z.enum(statusKindEnum.enumValues),
});

export async function addColumn(
  _prev: BoardFormState,
  formData: FormData,
): Promise<BoardFormState> {
  const viewer = await requireUser();
  const boardId = String(formData.get("boardId") ?? "");
  const parsed = columnInput.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  await assertCanManageBoard(viewer, boardId);

  const [{ next }] = await db
    .select({ next: max(boardStatuses.position) })
    .from(boardStatuses)
    .where(eq(boardStatuses.boardId, boardId));

  try {
    await db.insert(boardStatuses).values({
      boardId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      position: (next ?? -1) + 1,
    });
  } catch {
    return { error: "That board already has a column with that name." };
  }

  revalidatePath("/", "layout");
  return null;
}

export async function updateColumn(
  _prev: BoardFormState,
  formData: FormData,
): Promise<BoardFormState> {
  const viewer = await requireUser();
  const statusId = String(formData.get("statusId") ?? "");
  const parsed = columnInput.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  // Loaded for the permission check it performs, not for its value.
  await loadColumn(viewer, statusId);

  /*
   * Renaming or reclassifying a column says nothing about work already
   * finished.
   *
   * This used to rewrite `completed_at` for every task in the column — and
   * stamp `new Date()`, so reclassifying a column moved work completed a month
   * ago to today. A column's kind decides what happens to cards dropped there
   * *next*; completion is the task's own fact and is set by finishing it.
   */
  await db
    .update(boardStatuses)
    .set({ name: parsed.data.name, kind: parsed.data.kind })
    .where(eq(boardStatuses.id, statusId));

  revalidatePath("/", "layout");
  return null;
}

export async function deleteColumn(formData: FormData) {
  const viewer = await requireUser();
  const statusId = String(formData.get("statusId") ?? "");
  const column = await loadColumn(viewer, statusId);

  const [{ n }] = await db
    .select({ n: count() })
    .from(tasks)
    .where(eq(tasks.statusId, statusId));
  if (n > 0) throw new Error("Move this column's cards before removing it");

  const [{ remaining }] = await db
    .select({ remaining: count() })
    .from(boardStatuses)
    .where(eq(boardStatuses.boardId, column.boardId));
  if (remaining <= 1) throw new Error("A board needs at least one column");

  await db.delete(boardStatuses).where(eq(boardStatuses.id, statusId));
  revalidatePath("/", "layout");
}

/** Swaps a column with its neighbour, which is all reordering ever needs. */
export async function moveColumn(formData: FormData) {
  const viewer = await requireUser();
  const statusId = String(formData.get("statusId") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const column = await loadColumn(viewer, statusId);

  const siblings = await db
    .select({ id: boardStatuses.id, position: boardStatuses.position })
    .from(boardStatuses)
    .where(eq(boardStatuses.boardId, column.boardId))
    .orderBy(asc(boardStatuses.position), asc(boardStatuses.name));

  const index = siblings.findIndex((s) => s.id === statusId);
  const swapWith = siblings[index + direction];
  if (!swapWith) return;

  // Positions are rewritten from the array, so duplicates or gaps left by any
  // earlier edit heal themselves rather than accumulating.
  const reordered = [...siblings];
  [reordered[index], reordered[index + direction]] = [
    reordered[index + direction]!,
    reordered[index]!,
  ];

  await db.transaction(async (tx) => {
    for (const [i, s] of reordered.entries()) {
      await tx.update(boardStatuses).set({ position: i }).where(eq(boardStatuses.id, s.id));
    }
  });

  revalidatePath("/", "layout");
}

async function loadColumn(viewer: Awaited<ReturnType<typeof requireUser>>, statusId: string) {
  const [column] = await db
    .select({ id: boardStatuses.id, boardId: boardStatuses.boardId, kind: boardStatuses.kind })
    .from(boardStatuses)
    .where(eq(boardStatuses.id, statusId));
  if (!column) throw new Error("No such column");
  await assertCanManageBoard(viewer, column.boardId);
  return column;
}
