import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  accountMembers,
  chatMembers,
  chatMessages,
  chatRooms,
  boardStatuses,
  boards,
  taskActivity,
  documents,
  folders,
  taskAssignees,
  taskDocuments,
  tasks,
  leaveRequests,
  accounts,
  users,
} from "@/db/schema";
import { toPlainText } from "@meridian/ui/editor";
import { startOfAppDay } from "@/lib/date";
import { dayKey } from "@/lib/leave";
import type { Viewer } from "@/lib/auth";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** 1pm Manila on Monday 7 September 2026. */
export const NOW = new Date("2026-09-07T05:00:00Z");
export const TODAY = startOfAppDay(NOW);

export const IDS = {
  nike: "11111111-1111-4111-a111-111111111111",
  adidas: "22222222-2222-4222-a222-222222222222",
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
    sql`truncate chat_messages, chat_members, chat_rooms, leave_requests, task_schedule, notifications, task_activity, task_documents, documents, task_tags, task_assignees, task_attachments, tasks, campaigns, board_statuses, boards, tags, account_members, users, accounts restart identity cascade`,
  );
}

/** Two accounts, five people. Small enough that every expected number can be
 *  worked out by hand in the test itself.
 *
 *  Everybody starts on exactly one account, which is what the product used to
 *  assume — so a test that says nothing about membership still reads the way it
 *  always did. A test about working across accounts calls `addMembership` and
 *  says so out loud. */
export async function seedOrg() {
  await db.insert(accounts).values([
    { id: IDS.nike, name: "Nike" },
    { id: IDS.adidas, name: "Adidas" },
  ]);

  await db.insert(users).values([
    { id: IDS.anna, name: "Anna Santos", email: "anna@test.co", passwordHash: "x", role: "team_member", title: "Designer" },
    { id: IDS.james, name: "James Cruz", email: "james@test.co", passwordHash: "x", role: "team_member", title: "Copywriter" },
    { id: IDS.sarah, name: "Sarah Lim", email: "sarah@test.co", passwordHash: "x", role: "account_director" },
    { id: IDS.mika, name: "Mika Villanueva", email: "mika@test.co", passwordHash: "x", role: "team_member", title: "Paid Media" },
    { id: IDS.elena, name: "Elena Rivera", email: "elena@test.co", passwordHash: "x", role: "senior_director" },
  ]);

  await db.insert(accountMembers).values([
    { accountId: IDS.nike, userId: IDS.anna },
    { accountId: IDS.nike, userId: IDS.james },
    { accountId: IDS.nike, userId: IDS.sarah },
    { accountId: IDS.adidas, userId: IDS.mika },
  ]);

  await db.update(accounts).set({ accountDirectorId: IDS.sarah }).where(sql`id = ${IDS.nike}`);

  await db.insert(boards).values([
    { id: IDS.boardA, accountId: IDS.nike, name: "Nike", createdBy: IDS.sarah },
    { id: IDS.boardB, accountId: IDS.adidas, name: "Adidas", createdBy: IDS.elena },
  ]);

  await db.insert(boardStatuses).values(
    [IDS.boardA, IDS.boardB].flatMap((boardId) =>
      COLUMNS.map((c) => ({ id: statusId(boardId, c), boardId, ...COLUMN_SPEC[c] })),
    ),
  );
}

/** Puts somebody on another account. The thing the whole change exists for. */
export async function addMembership(accountId: string, userId: string) {
  await db.insert(accountMembers).values({ accountId, userId }).onConflictDoNothing();
}

/**
 * The `Viewer` a page would have been handed for this person.
 *
 * Permissions read `accountIds` and `directedIds` off the session rather than
 * querying, so a test that hands them a bare `users` row is testing something
 * the app never does. This builds the same thing `getSession` builds, from the
 * same two lookups.
 */
export async function viewerFor(userId: string): Promise<Viewer> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error(`No such user: ${userId}`);
  const [memberOf, directs] = await Promise.all([
    db
      .select({ accountId: accountMembers.accountId })
      .from(accountMembers)
      .where(eq(accountMembers.userId, userId)),
    db.select({ id: accounts.id }).from(accounts).where(eq(accounts.accountDirectorId, userId)),
  ]);
  const directedIds = directs.map((row) => row.id);
  const accountIds = [...new Set([...memberOf.map((row) => row.accountId), ...directedIds])];
  return { ...user, accountIds, directedIds };
}

/** The board an account's work lands on in the fixture. */
export const boardFor = (accountId: string) =>
  accountId === IDS.nike ? IDS.boardA : IDS.boardB;

let n = 0;

/**
 * `dueDay` is an offset in days from today (0 = today, -1 = yesterday).
 * `completedDay` is the same, or null for still-open. Times are set so a task
 * is due mid-afternoon and completed relative to that.
 */
export async function addTask(opts: {
  account: string;
  assignees: string[];
  dueDay: number;
  dueHour?: number;
  completedDay?: number | null;
  completedHour?: number;
  status?: Column;
  type?: "client_work" | "internal" | "admin" | "review" | "meeting" | "creative";
  /** Makes this a subtask of that task — and that task a container. */
  parent?: string;
}) {
  n += 1;
  const id = `dddddddd-${String(n).padStart(4, "0")}-4000-a000-000000000000`;
  const due = new Date(TODAY.getTime() + opts.dueDay * DAY + (opts.dueHour ?? 15) * HOUR);
  const completedAt =
    opts.completedDay === null || opts.completedDay === undefined
      ? null
      : new Date(TODAY.getTime() + opts.completedDay * DAY + (opts.completedHour ?? 14) * HOUR);

  const boardId = boardFor(opts.account);
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
    accountId: opts.account,
    parentId: opts.parent ?? null,
    createdAt: new Date(due.getTime() - DAY),
    updatedAt: due,
  });

  await db
    .insert(taskAssignees)
    .values(opts.assignees.map((userId) => ({ taskId: id, userId })));
  return id;
}

let docSeq = 0;
let folderSeq = 0;

/**
 * A folder. `account: null` is org-wide; one inside another takes its parent's
 * placement, exactly as the action does, so a test cannot build a tree the app
 * could never produce.
 */
export async function addFolder(opts: {
  name: string;
  account?: string | null;
  parent?: string | null;
  createdBy?: string;
}) {
  folderSeq += 1;
  const id = `0f000000-${String(folderSeq).padStart(4, "0")}-4000-a000-000000000000`;

  let visibility: "org" | "account" = opts.account ? "account" : "org";
  let accountId = opts.account ?? null;
  if (opts.parent) {
    const parent = await db.query.folders.findFirst({ where: sql`id = ${opts.parent}` });
    if (parent) {
      visibility = parent.visibility;
      accountId = parent.accountId;
    }
  }

  await db.insert(folders).values({
    id,
    name: opts.name,
    visibility,
    accountId,
    parentId: opts.parent ?? null,
    createdBy: opts.createdBy ?? IDS.elena,
  });
  return id;
}

/** A document. It takes its folder's placement when it is in one. */
export async function addDoc(opts: {
  title: string;
  body?: string;
  account?: string | null;
  folder?: string | null;
  createdBy?: string;
}) {
  docSeq += 1;
  const id = `0d000000-${String(docSeq).padStart(4, "0")}-4000-a000-000000000000`;

  let visibility: "org" | "account" = opts.account ? "account" : "org";
  let accountId = opts.account ?? null;
  if (opts.folder) {
    const folder = await db.query.folders.findFirst({ where: sql`id = ${opts.folder}` });
    if (folder) {
      visibility = folder.visibility;
      accountId = folder.accountId;
    }
  }

  await db.insert(documents).values({
    id,
    title: opts.title,
    body: opts.body ?? null,
    searchText: toPlainText(opts.body ?? null),
    visibility,
    accountId,
    folderId: opts.folder ?? null,
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

/** A BlockNote body that mentions the given people, as the editor writes it. */
export function bodyNaming(
  text: string,
  people: { id: string; name: string }[],
): string {
  return JSON.stringify([
    {
      type: "paragraph",
      content: [
        { type: "text", text, styles: {} },
        ...people.map((p) => ({
          type: "userMention",
          props: { userId: p.id, name: p.name },
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

/** A calendar day, `n` days from the fixture's today. */
export const day = (n: number) => dayKey(new Date(TODAY.getTime() + n * DAY));

let leaveN = 0;

/**
 * File a leave request. Offsets are days from today, the way `addTask`'s
 * `dueDay` is, so a test reads as "off from tomorrow for three days" rather
 * than as a date somebody has to work out.
 */
export async function addLeave(opts: {
  user: string;
  startDay: number;
  endDay?: number;
  half?: "am" | "pm";
  kind?: "vacation" | "sick" | "personal" | "unpaid";
  status?: "pending" | "approved" | "declined" | "cancelled";
  decidedBy?: string;
  note?: string;
}): Promise<string> {
  leaveN += 1;
  const id = `cafecafe-${String(leaveN).padStart(4, "0")}-4000-a000-000000000000`;

  await db.insert(leaveRequests).values({
    id,
    userId: opts.user,
    kind: opts.kind ?? "vacation",
    startDate: day(opts.startDay),
    endDate: day(opts.endDay ?? opts.startDay),
    half: opts.half ?? null,
    status: opts.status ?? "approved",
    decidedBy: opts.decidedBy ?? null,
    decidedAt: opts.status && opts.status === "pending" ? null : new Date(),
    note: opts.note ?? null,
  });

  return id;
}

/** A room and its members. `direct` pairs are keyed the way the action keys them. */
export async function addRoom(opts: {
  kind: "direct" | "channel";
  members: string[];
  name?: string;
}) {
  const directKey =
    opts.kind === "direct" ? [...opts.members].sort().join(":") : null;
  const [room] = await db
    .insert(chatRooms)
    .values({
      kind: opts.kind,
      name: opts.name ?? null,
      directKey,
      createdBy: opts.members[0]!,
    })
    .returning({ id: chatRooms.id });

  await db
    .insert(chatMembers)
    .values(opts.members.map((userId) => ({ roomId: room!.id, userId })));
  return room!.id;
}

/** One message, at a chosen moment so unread cursors can be tested. */
export async function addMessage(opts: {
  roomId: string;
  authorId: string;
  body?: string;
  minutesAgo?: number;
}) {
  const at = new Date(NOW.getTime() - (opts.minutesAgo ?? 0) * 60_000);
  const [row] = await db
    .insert(chatMessages)
    .values({
      roomId: opts.roomId,
      authorId: opts.authorId,
      body: opts.body ?? "hello",
      createdAt: at,
    })
    .returning({ id: chatMessages.id });
  return row!.id;
}
