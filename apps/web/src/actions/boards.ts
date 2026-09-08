"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, count, eq, isNull, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { boardStatuses, boards, statusKindEnum, tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { assertCanManageBoard, assertCanManageTeam } from "@/lib/permissions";

const name = z.string().trim().min(1, "Give it a name").max(60);

/** The columns a new board starts with — the four the product had before. */
const DEFAULT_COLUMNS = [
  { name: "To Do", kind: "open" as const, position: 0 },
  { name: "In Progress", kind: "open" as const, position: 1 },
  { name: "Done", kind: "done" as const, position: 2 },
  { name: "Blocked", kind: "blocked" as const, position: 3 },
];

export type BoardFormState = { error?: string } | null;

export async function createBoard(
  _prev: BoardFormState,
  formData: FormData,
): Promise<BoardFormState> {
  const viewer = await requireUser();
  /*
   * An empty team is a real choice, not a missing one: it files the board with
   * the department rather than with a team. Only the Senior Director may make
   * it — `assertCanManageTeam` refuses a null team to everybody else.
   */
  const teamId = String(formData.get("teamId") ?? "") || null;
  const parsed = name.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  await assertCanManageTeam(viewer, teamId);

  const [{ next }] = await db
    .select({ next: max(boards.position) })
    .from(boards)
    .where(teamId === null ? isNull(boards.teamId) : eq(boards.teamId, teamId));

  let board;
  try {
    [board] = await db
      .insert(boards)
      .values({
        teamId,
        name: parsed.data,
        position: (next ?? -1) + 1,
        createdBy: viewer.id,
      })
      .returning();
  } catch {
    // Either (team_id, name) or, for a department board, the partial unique
    // index on name alone.
    return {
      error: teamId
        ? "That team already has a board with that name."
        : "The department already has a board with that name.",
    };
  }

  // A board with no columns cannot hold work, so it never exists in that state.
  await db
    .insert(boardStatuses)
    .values(DEFAULT_COLUMNS.map((c) => ({ ...c, boardId: board.id })));

  revalidatePath("/", "layout");
  redirect(`/boards/${board.id}/settings`);
}

export async function renameBoard(
  _prev: BoardFormState,
  formData: FormData,
): Promise<BoardFormState> {
  const viewer = await requireUser();
  const boardId = String(formData.get("boardId") ?? "");
  const parsed = name.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  await assertCanManageBoard(viewer, boardId);
  await db
    .update(boards)
    .set({ name: parsed.data, updatedAt: new Date() })
    .where(eq(boards.id, boardId));

  revalidatePath("/", "layout");
  return null;
}

export async function deleteBoard(formData: FormData) {
  const viewer = await requireUser();
  const boardId = String(formData.get("boardId") ?? "");
  const board = await assertCanManageBoard(viewer, boardId);

  // Cascading would take the work with it. A board is a container, and
  // emptying it is a decision someone has to make on purpose.
  const [{ n }] = await db
    .select({ n: count() })
    .from(tasks)
    .where(eq(tasks.boardId, boardId));
  if (n > 0) throw new Error("Move or delete this board's tasks first");

  await db.delete(boards).where(eq(boards.id, boardId));
  revalidatePath("/", "layout");
  // A department board belongs to no team, so there is no team page to land on.
  redirect(board.teamId ? `/teams/${board.teamId}` : "/boards");
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
