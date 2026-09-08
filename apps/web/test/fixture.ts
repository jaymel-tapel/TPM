import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  boardStatuses,
  boards,
  taskActivity,
  documents,
  taskAssignees,
  taskDocuments,
  tasks,
  teams,
  users,
} from "@/db/schema";
import { toPlainText } from "@meridian/ui/editor";
import { startOfAppDay } from "@/lib/date";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** 1pm Manila on Monday 7 September 2026. */
export const NOW = new Date("2026-09-07T05:00:00Z");
export const TODAY = startOfAppDay(NOW);

export const IDS = {
  teamA: "11111111-1111-4111-a111-111111111111",
  teamB: "22222222-2222-4222-a222-222222222222",
  anna: "aaaaaaaa-1111-4111-a111-111111111111",
  james: "aaaaaaaa-2222-4222-a222-222222222222",
  sarah: "aaaaaaaa-3333-4333-a333-333333333333",
  mika: "bbbbbbbb-1111-4111-a111-111111111111",
  elena: "cccccccc-1111-4111-a111-111111111111",
  boardA: "eeeeeeee-1111-4111-a111-111111111111",
  boardB: "eeeeeeee-2222-4222-a222-222222222222",
};

/** The four columns each fixture board gets, keyed the way tests name them. */
export const COLUMNS = ["todo", "in_progress", "done", "blocked"] as const;
export type Column = (typeof COLUMNS)[number];

const COLUMN_SPEC: Record<Column, { name: string; kind: "open" | "done" | "blocked"; position: number }> = {
  todo: { name: "To Do", kind: "open", position: 0 },
  in_progress: { name: "In Progress", kind: "open", position: 1 },
  done: { name: "Done", kind: "done", position: 2 },
  blocked: { name: "Blocked", kind: "blocked", position: 3 },
};

/** Deterministic so a test can name a status without looking it up. */
export const statusId = (boardId: string, column: Column) =>
  `ffffffff-${COLUMNS.indexOf(column)}000-4000-a000-${boardId.slice(-12)}`;

export async function resetDb() {
  await db.execute(
    sql`truncate task_activity, task_documents, documents, task_tags, task_assignees, task_attachments, tasks, board_statuses, boards, tags, users, teams restart identity cascade`,
  );
}

/** Two teams, five people. Small enough that every expected number can be
 *  worked out by hand in the test itself. */
export async function seedOrg() {
  await db.insert(teams).values([
    { id: IDS.teamA, name: "Team A" },
    { id: IDS.teamB, name: "Team B" },
  ]);

  await db.insert(users).values([
    { id: IDS.anna, name: "Anna Santos", email: "anna@test.co", passwordHash: "x", role: "team_member", teamId: IDS.teamA },
    { id: IDS.james, name: "James Cruz", email: "james@test.co", passwordHash: "x", role: "team_member", teamId: IDS.teamA },
    { id: IDS.sarah, name: "Sarah Lim", email: "sarah@test.co", passwordHash: "x", role: "account_director", teamId: IDS.teamA },
    { id: IDS.mika, name: "Mika Villanueva", email: "mika@test.co", passwordHash: "x", role: "team_member", teamId: IDS.teamB },
    { id: IDS.elena, name: "Elena Rivera", email: "elena@test.co", passwordHash: "x", role: "senior_director", teamId: null },
  ]);

  await db.update(teams).set({ accountDirectorId: IDS.sarah }).where(sql`id = ${IDS.teamA}`);

  await db.insert(boards).values([
    { id: IDS.boardA, teamId: IDS.teamA, name: "Team A", createdBy: IDS.sarah },
    { id: IDS.boardB, teamId: IDS.teamB, name: "Team B", createdBy: IDS.elena },
  ]);

  await db.insert(boardStatuses).values(
    [IDS.boardA, IDS.boardB].flatMap((boardId) =>
      COLUMNS.map((c) => ({ id: statusId(boardId, c), boardId, ...COLUMN_SPEC[c] })),
    ),
  );
}

/** The board a team's work lands on in the fixture. */
export const boardFor = (teamId: string) =>
  teamId === IDS.teamA ? IDS.boardA : IDS.boardB;

let n = 0;

/**
 * `dueDay` is an offset in days from today (0 = today, -1 = yesterday).
 * `completedDay` is the same, or null for still-open. Times are set so a task
 * is due mid-afternoon and completed relative to that.
 */
export async function addTask(opts: {
  team: string;
  assignees: string[];
  dueDay: number;
  dueHour?: number;
  completedDay?: number | null;
  completedHour?: number;
  status?: Column;
  type?: "client_work" | "internal" | "admin" | "review" | "meeting" | "creative";
}) {
  n += 1;
  const id = `dddddddd-${String(n).padStart(4, "0")}-4000-a000-000000000000`;
  const due = new Date(TODAY.getTime() + opts.dueDay * DAY + (opts.dueHour ?? 15) * HOUR);
  const completedAt =
    opts.completedDay === null || opts.completedDay === undefined
      ? null
      : new Date(TODAY.getTime() + opts.completedDay * DAY + (opts.completedHour ?? 14) * HOUR);

  const boardId = boardFor(opts.team);
  await db.insert(tasks).values({
    id,
    title: `Task ${n}`,
    type: opts.type ?? "client_work",
    boardId,
    statusId: statusId(boardId, opts.status ?? (completedAt ? "done" : "todo")),
    priority: "normal",
    dueDate: due,
    completedAt,
    createdBy: opts.assignees[0],
    teamId: opts.team,
    createdAt: new Date(due.getTime() - DAY),
    updatedAt: due,
  });

  await db
    .insert(taskAssignees)
    .values(opts.assignees.map((userId) => ({ taskId: id, userId })));
  return id;
}

let docSeq = 0;

/**
 * A document. `team: null` is org-wide; anything filed under a parent takes the
 * parent's placement, exactly as the action does, so a test cannot accidentally
 * build a tree the app could never produce.
 */
export async function addDoc(opts: {
  title: string;
  body?: string;
  team?: string | null;
  parent?: string | null;
  createdBy?: string;
}) {
  docSeq += 1;
  const id = `0d000000-${String(docSeq).padStart(4, "0")}-4000-a000-000000000000`;

  let visibility: "org" | "team" = opts.team ? "team" : "org";
  let teamId = opts.team ?? null;
  if (opts.parent) {
    const parent = await db.query.documents.findFirst({
      where: sql`id = ${opts.parent}`,
    });
    if (parent) {
      visibility = parent.visibility;
      teamId = parent.teamId;
    }
  }

  await db.insert(documents).values({
    id,
    title: opts.title,
    body: opts.body ?? null,
    searchText: toPlainText(opts.body ?? null),
    visibility,
    teamId,
    parentId: opts.parent ?? null,
    createdBy: opts.createdBy ?? IDS.elena,
  });
  return id;
}

export async function linkDoc(
  taskId: string,
  documentId: string,
  source: "attached" | "mentioned" = "attached",
) {
  await db.insert(taskDocuments).values({ taskId, documentId, source }).onConflictDoNothing();
}

/** A BlockNote body that mentions the given documents, as the editor writes it. */
export function bodyMentioning(
  text: string,
  mentions: { id: string; title: string }[],
): string {
  return JSON.stringify([
    {
      type: "paragraph",
      content: [
        { type: "text", text, styles: {} },
        ...mentions.map((m) => ({
          type: "docMention",
          props: { docId: m.id, title: m.title, stale: false },
        })),
      ],
    },
  ]);
}

let activitySeq = 0;

/** One row on a task's stream. Ids are deterministic so a test can name one. */
export async function addActivity(opts: {
  taskId: string;
  actorId: string;
  kind: "comment" | "time_logged" | "created" | "status_changed" | "completed" | "reopened" | "assigned" | "unassigned" | "board_changed";
  body?: string;
  minutes?: number;
  fromLabel?: string;
  toLabel?: string;
  subjectName?: string;
  /** Minutes before NOW, so ordering is explicit rather than insertion-order. */
  minutesAgo?: number;
}) {
  activitySeq += 1;
  const id = `0a000000-${String(activitySeq).padStart(4, "0")}-4000-a000-000000000000`;
  await db.insert(taskActivity).values({
    id,
    taskId: opts.taskId,
    actorId: opts.actorId,
    kind: opts.kind,
    body: opts.body ?? null,
    minutes: opts.minutes ?? null,
    fromLabel: opts.fromLabel ?? null,
    toLabel: opts.toLabel ?? null,
    subjectName: opts.subjectName ?? null,
    createdAt: new Date(NOW.getTime() - (opts.minutesAgo ?? 0) * 60_000),
  });
  return id;
}
