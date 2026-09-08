"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, count, eq, inArray, sql } from "drizzle-orm";
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
import { requireSession, requireUser } from "@/lib/auth";
import { completionOnMove } from "@/lib/completion";
import { dayRange } from "@/lib/date";
import { ranksFor, weave } from "@/lib/rank";
import { boardOrder, boardWindowSql, isLeaf } from "@/queries/sql";
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
      completedAt: completionOnMove(status.kind, null),
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
      completedAt: completionOnMove(status.kind, existing.completedAt),
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

/**
 * The one-click affordance on every task row, and the only thing that decides
 * whether work is finished.
 *
 * It no longer moves the card. It used to, on the reasoning that a finished
 * task sitting in a column saying otherwise would make the board second-guess
 * every card — but that argument only holds while the column *is* the
 * completion. Now the card carries a tick of its own, so where it sits on the
 * board is a question about the workflow ("has the client seen it?") and the
 * tick is a question about the work ("is it done?"). Those are different
 * questions and a six-stage board needs both.
 */
export async function toggleTaskDone(formData: FormData) {
  const viewer = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const task = await loadEditableTask(viewer, taskId);

  /*
   * A task with children is a container: its children are the work, and they
   * are what the day counts. Ticking the container would claim a completion
   * that no report would ever see, so it is refused rather than silently
   * ignored.
   */
  const [{ children }] = await db
    .select({ children: count() })
    .from(tasks)
    .where(eq(tasks.parentId, taskId));
  if (children > 0) {
    throw new Error("Finish this task's subtasks — they are the work now.");
  }

  const done = task.completedAt !== null;
  const status = await statusLabel(task.statusId);

  await db
    .update(tasks)
    .set({
      completedAt: done ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  await recordActivity({
    taskId,
    actorId: viewer.id,
    kind: done ? "reopened" : "completed",
    // The column it happened in, which is now context rather than the cause.
    toLabel: status?.name ?? null,
  });

  refresh();
}

/** Twice the twelve a column shows. Anything longer is not a board drag. */
const MAX_ORDER = 24;

const moveInput = z.object({
  taskId: z.string().uuid(),
  statusId: z.string().uuid(),
  order: z.array(z.string().uuid()).max(MAX_ORDER),
});

/**
 * A card dropped somewhere — which column, and whereabouts in it.
 *
 * Not `setTaskStatus`, which is the keyboard's path from the task page and
 * rightly treats "the column it is already in" as nothing happening. Here that
 * is the ordinary case: a drop inside one column changes the arrangement and
 * nothing else, and an arrangement is not something a task's stream should
 * record.
 *
 * The destination column arrives as the ids the person saw, top first, rather
 * than as an index. An index is a coordinate into a list this action does not
 * have: the board is capped at twelve of a possibly longer column and scoped
 * to one day, so index three of what was on screen is not index three of the
 * column. The array is self-describing and cannot contradict itself.
 *
 * What it is *not* is the whole column — the cap hides cards, and a filter
 * hides more and scatters what is left. So the arrangement is woven back into
 * the column as the database holds it before anything is ranked; see `weave`.
 */
export async function moveTask(formData: FormData) {
  const { user: viewer, zone } = await requireSession();
  const input = moveInput.parse({
    taskId: formData.get("taskId"),
    statusId: formData.get("statusId"),
    order: formData.getAll("order").map(String),
  });

  const task = await loadEditableTask(viewer, input.taskId);
  const status = await statusOnBoard(input.statusId, task.boardId);
  if (!status) throw new Error("That status is not on this task's board");
  const changed = status.id !== task.statusId;

  /*
   * The destination column as the board would draw it, unfiltered and uncapped
   * — the same day window `getBoardView` uses, in the same order, so the two
   * agree on what "the column" is. Bounded by a day's work in one column.
   *
   * A card somebody else has since moved out simply is not in here, and
   * `ranksFor` drops it: a list naming it is stale rather than malicious, and
   * the rest of the arrangement is still worth honouring.
   */
  const { start, end } = dayRange(undefined, zone);
  const column = await db.execute(
    sql`select k.id, k.position from tasks k
        where k.board_id = ${task.boardId} and k.status_id = ${status.id}
          and ${isLeaf} and ${boardWindowSql(start, end)}
        order by ${boardOrder}`,
  );
  const rows = column.rows as unknown as { id: string; position: number }[];

  const current = new Map(rows.map((row) => [row.id, row.position]));
  // The card is not in that column yet when the status is changing.
  if (changed) current.set(task.id, task.position);

  const writes = ranksFor(
    weave(rows.map((row) => row.id), input.order),
    current,
  );
  // Dropped where it already was.
  if (!changed && writes.length === 0) return;

  await db.transaction(async (tx) => {
    if (changed) {
      await tx
        .update(tasks)
        .set({
          statusId: status.id,
          completedAt: completionOnMove(status.kind, task.completedAt),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, task.id));
    }
    for (const write of writes) {
      await tx.update(tasks).set({ position: write.position }).where(eq(tasks.id, write.id));
    }
  });

  /*
   * Only the crossing is an event. `updated_at` is not bumped for a reorder
   * either: the stream is what happened to the work, and "Anna put this second
   * instead of third" is not something anybody will want to read back.
   */
  if (changed) {
    const from = await statusLabel(task.statusId);
    const wasDone = task.completedAt !== null;
    const nowDone = wasDone || status.kind === "done";
    await recordActivity({
      taskId: task.id,
      actorId: viewer.id,
      kind: nowDone && !wasDone ? "completed" : "status_changed",
      fromLabel: from?.name ?? null,
      toLabel: status.name,
    });
  }

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
  // Only the crossing *into* done is an event now — a move can no longer
  // reopen anything, so there is no "reopened" to record here.
  const nowDone = wasDone || status.kind === "done";

  await db
    .update(tasks)
    .set({
      statusId: status.id,
      completedAt: completionOnMove(status.kind, task.completedAt),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  // Crossing into or out of done is the more interesting fact; a move between
  // two open columns is just a move.
  await recordActivity({
    taskId,
    actorId: viewer.id,
    kind: nowDone && !wasDone ? "completed" : "status_changed",
    fromLabel: from?.name ?? null,
    toLabel: status.name,
  });

  refresh();
}

const subtaskInput = z.object({
  parentId: z.string().uuid(),
  title: z.string().trim().min(1, "Give the subtask a title").max(200),
  assignees: z.array(z.string().uuid()).optional(),
  dueDate: z.string().optional(),
});

/**
 * Break a task into the pieces people will actually do.
 *
 * The brief calls these individual contributions — Anna: Data, James: Slides —
 * and they are real tasks: their own assignees, their own due date, their own
 * place on the board. What they are not is *extra* work: the moment a task has
 * children it stops counting itself, and its children count instead. See
 * `isLeaf`.
 *
 * Not `createTask`, which redirects to the new task; adding a subtask should
 * leave you looking at the parent.
 */
export async function createSubtask(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = subtaskInput.safeParse({
    parentId: formData.get("parentId"),
    title: formData.get("title"),
    assignees: formData.getAll("assignees").filter(Boolean),
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  const viewer = await requireUser();
  // Dividing work up is editing it, so this is the edit gate rather than the
  // view one that commenting uses.
  const parent = await loadEditableTask(viewer, parsed.data.parentId);

  /*
   * One level. A subtask of a subtask is a tree, and a tree is the nesting the
   * brief is a reaction against — depth is a cross-row property that Postgres
   * cannot check without a trigger, so it is checked here.
   */
  if (parent.parentId !== null) {
    return { error: "A subtask cannot be broken down further." };
  }

  const assignees = parsed.data.assignees ?? [];
  if (assignees.length > 0) {
    const strangers = await assigneesOutsideTeam(parent.teamId, assignees);
    if (strangers.length > 0) {
      return {
        error: `${strangers.join(", ")} ${strangers.length === 1 ? "is" : "are"} not on this board's team.`,
      };
    }
  }

  /*
   * Board, team and column come from the parent rather than being chosen. The
   * composite keys make that mandatory — a child has to sit on a column of its
   * own board — and it is also the rule folders already follow: scope is
   * copied down, never walked up at read time.
   */
  const [column] = await db
    .select({ id: boardStatuses.id, kind: boardStatuses.kind })
    .from(boardStatuses)
    .where(eq(boardStatuses.boardId, parent.boardId))
    .orderBy(boardStatuses.position, boardStatuses.name)
    .limit(1);
  if (!column) return { error: "That board has no columns." };

  const [child] = await db
    .insert(tasks)
    .values({
      title: parsed.data.title,
      parentId: parent.id,
      type: parent.type,
      priority: parent.priority,
      boardId: parent.boardId,
      statusId: column.id,
      // A piece inherits the whole's deadline unless somebody says otherwise.
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : parent.dueDate,
      createdBy: viewer.id,
      teamId: parent.teamId,
    })
    .returning();

  if (assignees.length > 0) {
    await db
      .insert(taskAssignees)
      .values(assignees.map((userId) => ({ taskId: child!.id, userId })));
  }

  await recordActivity({
    taskId: parent.id,
    actorId: viewer.id,
    kind: "created",
    subjectName: parsed.data.title,
  });

  const told = await notify({
    task: { ...parent, id: child!.id },
    actorId: viewer.id,
    kind: "assigned",
    userIds: assignees,
  });

  refresh();
  await deliver(told);
  return null;
}

export async function deleteTask(formData: FormData) {
  const viewer = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  await loadEditableTask(viewer, taskId);
  await db.delete(tasks).where(eq(tasks.id, taskId));
  refresh();
  redirect("/today");
}
