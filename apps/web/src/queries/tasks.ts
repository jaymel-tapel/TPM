import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { boardStatuses, boards, statusKindEnum, teams, type StatusKind } from "@/db/schema";

const isStatusKind = (value: string): value is StatusKind =>
  (statusKindEnum.enumValues as readonly string[]).includes(value);
import { dayRange, now, pct, type Zone } from "@/lib/date";
import {
  boardScopeSql,
  overdueSql,
  scopeSql,
  taskCardFrom,
  taskCardSelect,
  taskOrder,
  userScope,
  type Scope,
  type TaskCard,
} from "./sql";

async function runTaskQuery(
  where: ReturnType<typeof sql>,
  limit = 300,
  order = taskOrder,
) {
  const result = await db.execute(
    sql`select ${taskCardSelect} ${taskCardFrom} where ${where} order by ${order} limit ${limit}`,
  );

  /*
   * Timestamps come back as the strings Postgres printed: drizzle replaces
   * node-postgres' parsers so its query builder can map them itself, and a raw
   * `db.execute` gets no such treatment.
   *
   * Left as strings they type-check as `Date` and quietly misbehave —
   * `toTaskRow` compares `dueDate < startOfAppDay(...)`, which with a string on
   * the left is a string-versus-number comparison that is always false. Every
   * row's `overdue` flag read false because of it.
   */
  return (result.rows as unknown as RawTaskCard[]).map((row) => ({
    ...row,
    dueDate: new Date(row.dueDate),
    completedAt: row.completedAt === null ? null : new Date(row.completedAt),
  }));
}

/** What the driver actually hands back, before the timestamps are made real. */
type RawTaskCard = Omit<TaskCard, "dueDate" | "completedAt"> & {
  dueDate: string;
  completedAt: string | null;
};

/**
 * Work still ahead reads best in the order it arrives, not by priority.
 * "What is coming" is a question about time; the day's own lists are the ones
 * that should put urgent work first.
 */
const byDueDate = sql`k.due_date asc`;

export type DayView = {
  today: TaskCard[];
  completed: TaskCard[];
  overdue: TaskCard[];
  /** Still to come, within the horizon a day plan can reach. */
  upcoming: TaskCard[];
  due: number;
  done: number;
  percent: number;
};

/**
 * Screen 1. Splits the day into what's left, what's finished, and anything
 * that slipped from an earlier day — the three questions the brief asks.
 */
export async function getDayView(
  userId: string,
  reference: Date = now(),
  zone?: Zone,
  /** How far ahead "upcoming" reaches. Matches how far the plan can reach. */
  aheadDays = 7,
): Promise<DayView> {
  const { start, end } = dayRange(reference, zone);
  const horizon = new Date(end.getTime() + aheadDays * 86_400_000);
  const scope = scopeSql(userScope(userId));

  const dueToday = await runTaskQuery(
    sql`${scope} and k.due_date >= ${start} and k.due_date < ${end}`,
  );
  const overdue = await runTaskQuery(
    sql`${scope} and k.due_date < ${start} and k.completed_at is null`,
    50,
  );
  /*
   * Not part of the day's arithmetic — `due`, `done` and the percentage stay
   * about today, or the number stops meaning "how today went". This is here so
   * the day plan has something to reach for: the strip opens Thursday, and
   * Thursday's work should be on the page to drag.
   */
  const upcoming = await runTaskQuery(
    sql`${scope} and k.due_date >= ${end} and k.due_date < ${horizon} and k.completed_at is null`,
    50,
    byDueDate,
  );

  const completed = dueToday.filter((t) => t.completedAt !== null);
  const today = dueToday.filter((t) => t.completedAt === null);

  return {
    today,
    completed,
    overdue,
    upcoming,
    due: dueToday.length,
    done: completed.length,
    percent: pct(completed.length, dueToday.length),
  };
}

export type TaskFilters = {
  status?: string;
  type?: string;
  priority?: string;
  tag?: string;
  person?: string;
  range?: "today" | "week" | "overdue" | "all";
};

/** Backs the person drilldown. Kept narrow: filters, not a query builder. */
export async function listTasks(
  scope: Scope,
  filters: TaskFilters = {},
  reference: Date = now(),
  zone?: Zone,
): Promise<TaskCard[]> {
  const { start, end } = dayRange(reference, zone);
  const clauses = [scopeSql(scope)];

  /*
   * `s` is the joined board_statuses row. Filtering on a *kind* rather than a
   * column id is what makes this work across boards that name things
   * differently — the column this used to read was retired in 0005.
   *
   * The value is checked against the enum first: it arrives from a query
   * string, and an unknown one would reach Postgres as an invalid enum literal
   * and turn a typo in the URL into a 500.
   */
  if (filters.status && isStatusKind(filters.status)) {
    clauses.push(sql`s.kind = ${filters.status}`);
  }
  if (filters.type) clauses.push(sql`k.type = ${filters.type}`);
  if (filters.priority) clauses.push(sql`k.priority = ${filters.priority}`);
  if (filters.person) {
    clauses.push(
      sql`exists (select 1 from task_assignees fa where fa.task_id = k.id and fa.user_id = ${filters.person})`,
    );
  }
  if (filters.tag) {
    clauses.push(
      sql`exists (select 1 from task_tags ft join tags fg on fg.id = ft.tag_id where ft.task_id = k.id and fg.name = ${filters.tag})`,
    );
  }
  switch (filters.range) {
    case "today":
      clauses.push(sql`k.due_date >= ${start} and k.due_date < ${end}`);
      break;
    case "week":
      clauses.push(sql`k.due_date >= ${start} and k.due_date < ${new Date(end.getTime() + 6 * 86_400_000)}`);
      break;
    case "overdue":
      clauses.push(overdueSql(start));
      break;
    default:
      // Everything still open, plus what was finished today. Older history is
      // reachable through the date filter rather than dumped on the page.
      clauses.push(sql`(k.completed_at is null or k.completed_at >= ${start})`);
  }

  return runTaskQuery(sql.join(clauses, sql` and `));
}

export async function getTaskCard(taskId: string): Promise<TaskCard | null> {
  const rows = await runTaskQuery(sql`k.id = ${taskId}`, 1);
  return rows[0] ?? null;
}

export async function listAllTags(): Promise<string[]> {
  const result = await db.execute(sql`select name from tags order by name`);
  return (result.rows as { name: string }[]).map((r) => r.name);
}

export type BoardColumn = {
  id: string;
  name: string;
  kind: StatusKind;
  tasks: TaskCard[];
};

export type BoardView = {
  boardId: string;
  boardName: string;
  columns: BoardColumn[];
  total: number;
};

/**
 * The board is a second lens on the day, not a second source of truth: it
 * shows exactly what the team screen reasons about — due today, carried over
 * from an earlier day, and completed today.
 *
 * Showing every task ever would make the Done column grow without bound and
 * turn the board into a backlog, which is the thing the brief is a reaction
 * against.
 *
 * Columns come from the board itself, in the order its owner arranged them.
 * Grouping is by `status_id` alone: nothing has to second-guess a task's
 * column, because moving into a `done` column is the only thing that stamps
 * `completed_at` and moving out is the only thing that clears it.
 */
export async function getBoardView(
  boardId: string,
  reference: Date = now(),
  /** Narrows to the work this person is on. Null shows the whole board. */
  assigneeId: string | null = null,
  zone?: Zone,
): Promise<BoardView | null> {
  const { start, end } = dayRange(reference, zone);

  const [board] = await db
    .select({ id: boards.id, name: boards.name })
    .from(boards)
    .where(eq(boards.id, boardId));
  if (!board) return null;

  const columns = await db
    .select({ id: boardStatuses.id, name: boardStatuses.name, kind: boardStatuses.kind })
    .from(boardStatuses)
    .where(eq(boardStatuses.boardId, boardId))
    .orderBy(boardStatuses.position, boardStatuses.name);

  // Reuses the same `exists (…task_assignees…)` fragment every other
  // person-scoped query uses, so "mine" means the same thing everywhere.
  const mine = assigneeId ? sql` and ${scopeSql(userScope(assigneeId))}` : sql``;

  const rows = await runTaskQuery(
    sql`${boardScopeSql(boardId)}${mine} and (
      (k.due_date >= ${start} and k.due_date < ${end})
      or ${overdueSql(start)}
      or (k.completed_at >= ${start} and k.completed_at < ${end})
    )`,
    400,
  );

  const byStatus = new Map<string, TaskCard[]>(columns.map((c) => [c.id, []]));
  for (const task of rows) byStatus.get(task.statusId)?.push(task);

  return {
    boardId: board.id,
    boardName: board.name,
    columns: columns.map((c) => ({ ...c, tasks: byStatus.get(c.id) ?? [] })),
    total: rows.length,
  };
}

/** Boards a person can open, newest team first. Drives the sidebar. */
export async function listBoardsForUser(user: {
  role: string;
  teamId: string | null;
}): Promise<{ id: string; name: string; teamId: string; teamName: string }[]> {
  const where =
    user.role === "senior_director"
      ? undefined
      : user.teamId
        ? eq(boards.teamId, user.teamId)
        : sql`false`;

  return db
    .select({
      id: boards.id,
      name: boards.name,
      teamId: boards.teamId,
      teamName: teams.name,
    })
    .from(boards)
    .innerJoin(teams, eq(teams.id, boards.teamId))
    .where(where)
    .orderBy(teams.name, boards.position, boards.name);
}
