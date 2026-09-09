"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, count, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { boardStatuses, boards, statusKindEnum, tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { assertCanManageAccount, assertCanManageBoard } from "@/lib/permissions";

const name = z.string().trim().min(1, "Give it a name").max(60);

export type BoardFormState = { error?: string } | null;

/** The columns a board starts with — the four the product had before. */
const DEFAULT_COLUMNS = [
  { name: "To Do", kind: "open" as const, position: 0 },
  { name: "In Progress", kind: "open" as const, position: 1 },
  { name: "Done", kind: "done" as const, position: 2 },
  { name: "Blocked", kind: "blocked" as const, position: 3 },
];

/**
 * A new board on one account.
 *
 * A client has more than one because their pipelines do not share stages —
 * creative moves through concept and rounds, media through setup and
 * optimisation — and forcing both into one set of columns makes the columns
 * mean nothing. So: boards are per account, made by the director who runs it,
 * and they live under that account's Tasks rather than in a section of their
 * own. There is no department-wide board and no board picker in the rail's top
 * level; that was the shape that gave every client two homes.
 */
export async function createBoard(
  _prev: BoardFormState,
  formData: FormData,
): Promise<BoardFormState> {
  const viewer = await requireUser();
  const accountId = String(formData.get("accountId") ?? "");
  const parsed = name.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  // Directing it, not merely working on it — the same rule that gates the
  // columns. Being on a client lets you move a card, not invent a pipeline.
  await assertCanManageAccount(viewer, accountId);

  const [{ next }] = await db
    .select({ next: max(boards.position) })
    .from(boards)
    .where(eq(boards.accountId, accountId));

  let board;
  try {
    [board] = await db
      .insert(boards)
      .values({
        accountId,
        name: parsed.data,
        position: (next ?? -1) + 1,
        createdBy: viewer.id,
      })
      .returning();
  } catch {
    return { error: "That account already has a board with that name." };
  }

  // A board with no columns cannot hold work, so it never exists in that state.
  await db
    .insert(boardStatuses)
    .values(DEFAULT_COLUMNS.map((c) => ({ ...c, boardId: board!.id })));

  revalidatePath("/", "layout");
  redirect(`/accounts/${accountId}/tasks/${board!.id}/columns`);
}

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
