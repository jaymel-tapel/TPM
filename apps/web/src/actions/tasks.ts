"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { parseDuration } from "@/lib/duration";
import { db } from "@/db";
import {
  boardStatuses,
  boards,
  taskActivity,
  priorityEnum,
  taskAssignees,
  taskTags,
  taskTypeEnum,
  tags,
  tasks,
  users,
  type ActivityKind,
  type StatusKind,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { collectPeople } from "@meridian/ui/editor";
import { syncMentionedDocs } from "@/lib/doc-links";
import { deliver, notify } from "@/lib/notify";
import { assertCanViewTeamWork, loadEditableTask } from "@/lib/permissions";
import { assigneesOutsideTeam } from "@/queries/team";

const taskInput = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200),
  // A BlockNote document, not prose: the cap is a sanity limit on the JSON,
  // not a word count. Images live in object storage and appear here only as a
  // URL, so a long description is long because someone wrote a lot.
  description: z.string().trim().max(200_000).optional().nullable(),
  type: z.enum(taskTypeEnum.enumValues),
  priority: z.enum(priorityEnum.enumValues),
  /** A `board_statuses` row. Validated against the board below, not here. */
  statusId: z.string().uuid("Pick a status"),
  boardId: z.string().uuid("Pick a board"),
  /** datetime-local value, read in the browser's own zone. */
  dueDate: z.string().min(1, "Pick a due date"),
  /*
   * Typed as people say it — "2d 4h" — and stored as minutes. An unparseable
   * string is rejected rather than quietly dropped: somebody who typed
   * something meant something by it.
   */
  estimate: z.string().trim().optional().nullable(),
  assignees: z.array(z.string().uuid()).min(1, "Assign the task to someone"),
  tags: z.array(z.string().trim()).default([]),
});

function parse(formData: FormData) {
  return taskInput.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    type: formData.get("type"),
    priority: formData.get("priority"),
    statusId: formData.get("statusId"),
    boardId: formData.get("boardId"),
    dueDate: formData.get("dueDate"),
    estimate: formData.get("estimate"),
    assignees: formData.getAll("assignees").map(String),
    tags: formData
      .getAll("tags")
      .map(String)
      .filter(Boolean),
  });
}

/** Tags are a small shared vocabulary — created on first use, never managed. */
async function linkTags(taskId: string, names: string[]) {
  await db.delete(taskTags).where(eq(taskTags.taskId, taskId));
  if (names.length === 0) return;

  const existing = await db.query.tags.findMany({ where: inArray(tags.name, names) });
  const known = new Map(existing.map((t) => [t.name, t.id]));
  const missing = names.filter((n) => !known.has(n));

  if (missing.length > 0) {
    const created = await db
      .insert(tags)
      .values(missing.map((name) => ({ name })))
      .onConflictDoNothing()
      .returning();
    for (const t of created) known.set(t.name, t.id);
  }

  const rows = names
    .map((n) => known.get(n))
    .filter((id): id is string => Boolean(id))
    .map((tagId) => ({ taskId, tagId }));
  if (rows.length > 0) await db.insert(taskTags).values(rows).onConflictDoNothing();
}

function refresh() {
  revalidatePath("/", "layout");
}

/** "" and null both mean "not estimated"; anything else must actually parse. */
function readDuration(value: string | null | undefined) {
  if (value === null || value === undefined || value.trim() === "") {
    return { ok: true as const, minutes: null };
  }
  const minutes = parseDuration(value);
  return minutes === null
    ? { ok: false as const, minutes: null }
    : { ok: true as const, minutes };
}

/**
 * One row on the task's stream. Labels are snapshots — the name a column had
 * when this happened — so renaming or deleting it later cannot rewrite the
 * past. See the note on `taskActivity` in the schema.
 */
async function recordActivity(entry: {
  taskId: string;
  actorId: string;
  kind: ActivityKind;
  fromLabel?: string | null;
  toLabel?: string | null;
  subjectName?: string | null;
}) {
  const [row] = await db.insert(taskActivity).values(entry).returning({
    id: taskActivity.id,
  });
  return row!.id;
}

/** The column's name and kind, for both the write and the record of it. */
async function statusLabel(statusId: string) {
  const [row] = await db
    .select({ name: boardStatuses.name, kind: boardStatuses.kind })
    .from(boardStatuses)
    .where(eq(boardStatuses.id, statusId));
  return row ?? null;
}

export type FormState = { error?: string } | null;

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const input = parsed.data;

  const status = await statusOnBoard(input.statusId, input.boardId);
  if (!status) return { error: "That status is not on that board." };

  const estimate = readDuration(input.estimate);
  if (!estimate.ok) return { error: "Estimate should read like 2d 4h." };

  // The task belongs to the team that owns the board it is filed on, so the
  // denormalised copy can never disagree with it.
  const [board] = await db
    .select({ teamId: boards.teamId })
    .from(boards)
    .where(eq(boards.id, input.boardId));
  if (!board) return { error: "Pick a board." };
  await assertCanViewTeamWork(viewer, board.teamId);

  /*
   * Everyone on the task has to be on the board's team. Checked over the whole
   * list, not just the first: the ids come from a form, and a payload naming
   * one teammate and three strangers would otherwise pass on the strength of
   * the teammate.
   */
  const strangers = await assigneesOutsideTeam(board.teamId, input.assignees);
  if (strangers.length > 0) {
    return {
      error: `${strangers.join(", ")} ${strangers.length === 1 ? "is" : "are"} not on this board's team.`,
    };
  }

  const [task] = await db
    .insert(tasks)
    .values({
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      priority: input.priority,
      boardId: input.boardId,
      statusId: status.id,
      dueDate: new Date(input.dueDate),
      estimateMinutes: estimate.minutes,
      completedAt: completionStamp(status.kind, null),
      createdBy: viewer.id,
      teamId: board.teamId,
    })
    .returning();

  await db
    .insert(taskAssignees)
    .values(input.assignees.map((userId) => ({ taskId: task.id, userId })));
  await linkTags(task.id, input.tags);
  await syncMentionedDocs(viewer, task.id, input.description ?? null);
  await recordActivity({
    taskId: task.id,
    actorId: viewer.id,
    kind: "created",
    toLabel: status.name,
  });

  const told = await notify({
    task,
    actorId: viewer.id,
    kind: "assigned",
    userIds: input.assignees,
  });
  const mentioned = await notify({
    task,
    actorId: viewer.id,
    kind: "mentioned",
    userIds: collectPeople(input.description).map((p) => p.userId),
  });

  refresh();
  await deliver([...told, ...mentioned]);
  redirect(`/tasks/${task.id}`);
}

export async function updateTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const existing = await loadEditableTask(viewer, taskId);

  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const input = parsed.data;

  const status = await statusOnBoard(input.statusId, input.boardId);
  if (!status) return { error: "That status is not on that board." };

  const estimate = readDuration(input.estimate);
  if (!estimate.ok) return { error: "Estimate should read like 2d 4h." };

  const [board] = await db
    .select({ teamId: boards.teamId })
    .from(boards)
    .where(eq(boards.id, input.boardId));
  if (!board) return { error: "Pick a board." };
  await assertCanViewTeamWork(viewer, board.teamId);

  /*
   * Everyone on the task has to be on the board's team. Checked over the whole
   * list, not just the first: the ids come from a form, and a payload naming
   * one teammate and three strangers would otherwise pass on the strength of
   * the teammate.
   */
  const strangers = await assigneesOutsideTeam(board.teamId, input.assignees);
  if (strangers.length > 0) {
    return {
      error: `${strangers.join(", ")} ${strangers.length === 1 ? "is" : "are"} not on this board's team.`,
    };
  }

  /*
   * What actually changed, worked out before the write. Save rewrites every
   * field whether or not it differs, so without this a save with no edits
   * would post a handful of events saying nothing happened.
   */
  const wasStatus = existing.statusId === status.id ? null : await statusLabel(existing.statusId);
  const boardMoved = existing.boardId !== input.boardId;
  const before = await db
    .select({ userId: taskAssignees.userId, name: users.name })
    .from(taskAssignees)
    .innerJoin(users, eq(users.id, taskAssignees.userId))
    .where(eq(taskAssignees.taskId, taskId));
  /*
   * Who the description already named. A save rewrites the whole body, so
   * without this a fixed typo would notify everyone mentioned in it all over
   * again. Only names that were not there before are new news.
   */
  const namedBefore = new Set(collectPeople(existing.description).map((p) => p.userId));

  await db
    .update(tasks)
    .set({
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      priority: input.priority,
      boardId: input.boardId,
      statusId: status.id,
      teamId: board.teamId,
      dueDate: new Date(input.dueDate),
      estimateMinutes: estimate.minutes,
      // `actualMinutes` is deliberately absent: it is the sum of logged time
      // and is written only by the actions that add or remove an entry.
      completedAt: completionStamp(status.kind, existing.completedAt),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
  await db
    .insert(taskAssignees)
    .values(input.assignees.map((userId) => ({ taskId, userId })));
  await linkTags(taskId, input.tags);
  await syncMentionedDocs(viewer, taskId, input.description ?? null);

  if (wasStatus) {
    await recordActivity({
      taskId,
      actorId: viewer.id,
      kind: "status_changed",
      fromLabel: wasStatus.name,
      toLabel: status.name,
    });
  }
  if (boardMoved) {
    const [from] = await db
      .select({ name: boards.name })
      .from(boards)
      .where(eq(boards.id, existing.boardId));
    const [to] = await db
      .select({ name: boards.name })
      .from(boards)
      .where(eq(boards.id, input.boardId));
    await recordActivity({
      taskId,
      actorId: viewer.id,
      kind: "board_changed",
      fromLabel: from?.name ?? null,
      toLabel: to?.name ?? null,
    });
  }

  const had = new Map(before.map((a) => [a.userId, a.name]));
  const now = new Set(input.assignees);
  const nudge: string[] = [];
  for (const userId of input.assignees) {
    if (had.has(userId)) continue;
    const [person] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId));
    const activityId = await recordActivity({
      taskId,
      actorId: viewer.id,
      kind: "assigned",
      subjectName: person?.name ?? null,
    });
    // Only the people newly added — `input.assignees` is the whole list on
    // every save, so notifying it wholesale would re-tell everyone each time.
    nudge.push(
      ...(await notify({
        task: { ...existing, teamId: board.teamId },
        actorId: viewer.id,
        kind: "assigned",
        activityId,
        userIds: [userId],
      })),
    );
  }
  nudge.push(
    ...(await notify({
      task: { ...existing, teamId: board.teamId },
      actorId: viewer.id,
      kind: "mentioned",
      userIds: collectPeople(input.description)
        .map((p) => p.userId)
        .filter((id) => !namedBefore.has(id)),
    })),
  );
  for (const [userId, name] of had) {
    if (now.has(userId)) continue;
    await recordActivity({
      taskId,
      actorId: viewer.id,
      kind: "unassigned",
      subjectName: name,
    });
  }

  refresh();
  await deliver(nudge);
  redirect(`/tasks/${taskId}`);
}

/**
 * `completed_at` is what every report reads, so it is stamped on the way into
 * a `done` column and cleared on the way out — never left stale. A board owner
 * can rename or reorder columns freely; only `kind` decides this.
 */
function completionStamp(kind: StatusKind, current: Date | null): Date | null {
  return kind === "done" ? (current ?? new Date()) : null;
}

/**
 * Resolves a status to the board it is on, which is the only place that
 * pairing is trusted. Returns null when the status does not belong to the
 * board the caller claims — the composite foreign key would refuse the write
 * anyway, but a form should not have to learn that from a database error.
 */
async function statusOnBoard(statusId: string, boardId: string) {
  const [row] = await db
    .select({
      id: boardStatuses.id,
      name: boardStatuses.name,
      kind: boardStatuses.kind,
      boardId: boardStatuses.boardId,
    })
    .from(boardStatuses)
    .where(and(eq(boardStatuses.id, statusId), eq(boardStatuses.boardId, boardId)));
  return row ?? null;
}

/** The column a board sends work to, by kind and then by its own order. */
async function firstStatusOfKind(boardId: string, kind: StatusKind) {
  const [row] = await db
    .select({ id: boardStatuses.id, name: boardStatuses.name, kind: boardStatuses.kind })
    .from(boardStatuses)
    .where(and(eq(boardStatuses.boardId, boardId), eq(boardStatuses.kind, kind)))
    .orderBy(boardStatuses.position, boardStatuses.name)
    .limit(1);
  return row ?? null;
}

/** The one-click affordance on every task row. */
export async function toggleTaskDone(formData: FormData) {
  const viewer = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const task = await loadEditableTask(viewer, taskId);

  /*
   * Ticking a task moves it into its board's `done` column, rather than only
   * stamping `completed_at`. If it just stamped, a finished task would sit in
   * a column that says otherwise, and the board would have to second-guess
   * every card. Untick sends it back to the first open column.
   */
  const done = task.completedAt !== null;
  const target = await firstStatusOfKind(task.boardId, done ? "open" : "done");
  if (!target) throw new Error(`Board has no ${done ? "open" : "done"} column`);

  const from = await statusLabel(task.statusId);

  await db
    .update(tasks)
    .set({
      statusId: target.id,
      completedAt: completionStamp(target.kind, done ? null : task.completedAt),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  await recordActivity({
    taskId,
    actorId: viewer.id,
    kind: done ? "reopened" : "completed",
    fromLabel: from?.name ?? null,
    toLabel: target.name,
  });

  refresh();
}

export async function setTaskStatus(formData: FormData) {
  const viewer = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const statusId = z.string().uuid().parse(formData.get("statusId"));
  const task = await loadEditableTask(viewer, taskId);

  // Only columns on the task's own board. Dragging cannot smuggle a task onto
  // someone else's board, and the composite key would refuse it if it tried.
  const status = await statusOnBoard(statusId, task.boardId);
  if (!status) throw new Error("That status is not on this task's board");
  // Clicking the column a task is already in is not an event.
  if (status.id === task.statusId) return;

  const from = await statusLabel(task.statusId);
  const wasDone = task.completedAt !== null;
  const nowDone = status.kind === "done";

  await db
    .update(tasks)
    .set({
      statusId: status.id,
      completedAt: completionStamp(status.kind, task.completedAt),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  // Crossing into or out of done is the more interesting fact; a move between
  // two open columns is just a move.
  await recordActivity({
    taskId,
    actorId: viewer.id,
    kind: nowDone && !wasDone ? "completed" : !nowDone && wasDone ? "reopened" : "status_changed",
    fromLabel: from?.name ?? null,
    toLabel: status.name,
  });

  refresh();
}

export async function deleteTask(formData: FormData) {
  const viewer = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  await loadEditableTask(viewer, taskId);
  await db.delete(tasks).where(eq(tasks.id, taskId));
  refresh();
  redirect("/today");
}
