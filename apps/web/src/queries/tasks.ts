import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  boardStatuses,
  boards,
  priorityEnum,
  statusKindEnum,
  type Priority,
  type StatusKind,
} from "@/db/schema";

/*
 * Filters arrive from a query string, so every enum-valued one is checked
 * before it reaches Postgres: an unknown value would land as an invalid enum
 * literal and turn a typo in a URL — or a bookmark kept past a rename — into a
 * 500. Checked here rather than at the page, so the guarantee belongs to the
 * query and holds for whatever calls it next.
 *
 * Task type needs no guard any more. It is a row rather than an enum member,
 * so an unknown slug is a comparison that matches nothing.
 */
const isStatusKind = (value: string): value is StatusKind =>
  (statusKindEnum.enumValues as readonly string[]).includes(value);
const isPriority = (value: string): value is Priority =>
  (priorityEnum.enumValues as readonly string[]).includes(value);
import { dayRange, now, pct, type Zone } from "@/lib/date";
import {
  boardOrder,
  boardScopeSql,
  boardWindowSql,
  overdueSql,
  scopeSql,
  taskCardFrom,
  isLeaf,
  taskCardSelect,
  taskOrder,
  userScope,
  uuids,
  type Scope,
  type TaskCard,
} from "./sql";

/**
 * Lists of work. Containers are excluded by default — a task somebody has
 * broken into pieces is not itself a thing to do, and its children stand in
 * for it everywhere.
 *
 * `containers: true` is for the one caller that means a specific task rather
 * than a list of work: opening a parent's own page.
 */
async function runTaskQuery(
  where: ReturnType<typeof sql>,
  limit = 300,
  order = taskOrder,
  { containers = false }: { containers?: boolean } = {},
) {
  const result = await db.execute(
    // `isLeaf` here covers every list; the raw counters in account.ts,
    // department.ts, reports.ts and attention.ts each apply it themselves.
    sql`select ${taskCardSelect} ${taskCardFrom}
        where ${where} ${containers ? sql`` : sql`and ${isLeaf}`}
        order by ${order} limit ${limit}`,
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

/** The four filters that mean the same thing wherever they are asked. */
export type WorkFilters = Pick<TaskFilters, "status" | "type" | "priority" | "tag">;

/**
 * What `WorkFilters` narrows to, as SQL.
 *
 * One definition, because the list and the board have to mean the same thing
 * by "Review": they render the same cards through the same components, and a
 * filter that agreed with itself only most of the time would be worse than
 * none. Anything unrecognised is dropped rather than thrown on — a stale link
 * should show the board, not an error page.
 *
 * `s` is the joined `board_statuses` row. Filtering on a status *kind* rather
 * than a column id is what makes it work across boards that name their columns
 * differently.
 */
export function workFilterSql(filters: WorkFilters): ReturnType<typeof sql>[] {
  const clauses: ReturnType<typeof sql>[] = [];
  if (filters.status && isStatusKind(filters.status)) {
    clauses.push(sql`s.kind = ${filters.status}`);
  }
  /*
   * `ty` is the joined `task_types` row, the way `s` is the joined column —
   * see `taskCardFrom`. Matching the slug rather than checking it first is
   * what retired the guard this used to need: a kind that does not exist
   * simply matches nothing, exactly as an unknown tag already did.
   */
  if (filters.type) clauses.push(sql`ty.slug = ${filters.type}`);
  if (filters.priority && isPriority(filters.priority)) {
    clauses.push(sql`k.priority = ${filters.priority}`);
  }
  // Text, so an unknown tag needs no guard: it simply matches nothing.
  if (filters.tag) {
    clauses.push(
      sql`exists (select 1 from task_tags ft join tags fg on fg.id = ft.tag_id where ft.task_id = k.id and fg.name = ${filters.tag})`,
    );
  }
  return clauses;
}

/** Backs the person drilldown. Kept narrow: filters, not a query builder. */
export async function listTasks(
  scope: Scope,
  filters: TaskFilters = {},
  reference: Date = now(),
  zone?: Zone,
): Promise<TaskCard[]> {
  const { start, end } = dayRange(reference, zone);
  const clauses = [scopeSql(scope), ...workFilterSql(filters)];

  if (filters.person) {
    clauses.push(
      sql`exists (select 1 from task_assignees fa where fa.task_id = k.id and fa.user_id = ${filters.person})`,
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

/**
 * One task by id, container or not — the detail page has to open a parent as
 * readily as a leaf.
 */
export async function getTaskCard(taskId: string): Promise<TaskCard | null> {
  const rows = await runTaskQuery(sql`k.id = ${taskId}`, 1, taskOrder, { containers: true });
  return rows[0] ?? null;
}

export async function listAllTags(): Promise<string[]> {
  // Retired tags are not offered. They stay on the work that already wears
  // them, which is why the card projection does not filter the same way.
  const result = await db.execute(sql`select name from tags where archived_at is null order by name`);
  return (result.rows as { name: string }[]).map((r) => r.name);
}

/**
 * Every tag with how much work carries it, retired ones included.
 *
 * The count is what makes retiring a decision rather than a guess — the same
 * job `AdminPerson.taskCount` does on the people list.
 */
export async function listTagsWithUse(): Promise<
  { id: string; name: string; taskCount: number; archivedAt: Date | null }[]
> {
  const result = await db.execute(sql`
    select g.id, g.name, g.archived_at as "archivedAt",
           (select count(*) from task_tags tt where tt.tag_id = g.id)::int as "taskCount"
    from tags g
    order by g.name
  `);
  return result.rows as unknown as {
    id: string;
    name: string;
    taskCount: number;
    archivedAt: Date | null;
  }[];
}

/**
 * The tags in play on one board, for the filter to offer.
 *
 * Not `listAllTags` — that is every client name in the department, and a menu
 * on Brand & Creative offering a tag only Performance Media uses is a menu of
 * empty boards. Scoped to the board rather than to the day, so a tag does not
 * vanish from the list because today happens to be quiet.
 */
export async function listBoardTags(boardId: string): Promise<string[]> {
  const result = await db.execute(sql`
    select distinct g.name
    from tags g
    join task_tags tt on tt.tag_id = g.id
    join tasks k on k.id = tt.task_id
    where ${boardScopeSql(boardId)} and ${isLeaf} and g.archived_at is null
    order by g.name
  `);
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
 * shows exactly what the account screen reasons about — due today, carried over
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
/**
 * Everything that narrows a board, in one bag.
 *
 * `type` used to sit here as its own clause; it is in `WorkFilters` now,
 * beside priority and tag, so the board and the list mean the same thing by
 * "Review" and only one place has to guard the value.
 */
export type BoardFilters = WorkFilters & {
  /** Narrows to the work this person is on. Null shows everyone's. */
  assigneeId?: string | null;
  /** Narrows to one campaign. Null shows work in and out of campaigns alike. */
  campaignId?: string | null;
};

export async function getBoardView(
  boardId: string,
  reference: Date = now(),
  filters: BoardFilters = {},
  zone?: Zone,
): Promise<BoardView | null> {
  const { start, end } = dayRange(reference, zone);
  const { assigneeId = null, campaignId = null, ...work } = filters;

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
  const inCampaign = campaignId ? sql` and k.campaign_id = ${campaignId}::uuid` : sql``;
  /*
   * Narrowing happens in the query, not after it, so the count in each column
   * header counts what is on the screen. A board that said "19" over three
   * cards would be reporting on a board nobody is looking at.
   */
  const narrowed = workFilterSql(work);
  const narrowing = narrowed.length ? sql` and ${sql.join(narrowed, sql` and `)}` : sql``;

  const rows = await runTaskQuery(
    sql`${boardScopeSql(boardId)}${mine}${inCampaign}${narrowing} and ${boardWindowSql(start, end)}`,
    400,
    boardOrder,
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

/** Boards a person can open, newest account first. Drives the sidebar. */
/** Every board on these accounts, for the rail. Ordered as each account arranged them. */
export async function listBoardsForAccounts(
  accountIds: string[],
): Promise<{ id: string; name: string; accountId: string }[]> {
  if (accountIds.length === 0) return [];
  const rows = await db
    .select({ id: boards.id, name: boards.name, accountId: boards.accountId })
    .from(boards)
    .where(inArray(boards.accountId, accountIds))
    .orderBy(boards.position, boards.name);
  return rows.filter(
    (row): row is { id: string; name: string; accountId: string } => row.accountId !== null,
  );
}

/**
 * The pieces a task was broken into, in the order they will be worked.
 *
 * Deliberately not filtered by `isLeaf` — this asks for children, and a child
 * with children of its own is a branch rather than a mistake.
 */
export async function listSubtasks(parentId: string): Promise<TaskCard[]> {
  return runTaskQuery(sql`k.parent_id = ${parentId}`, 100, byDueDate, { containers: true });
}

/**
 * Everything beneath a task, however deep — the whole branch in one query.
 *
 * A page that fetched one level and let each row fetch its own would be a
 * query per node and a waterfall per level; the tree is small enough that
 * fetching it whole is both faster and easier to reason about. The caller
 * assembles the shape from `parentId`, which `taskCardSelect` already carries.
 *
 * The recursion is bounded twice over: `createSubtask` refuses to nest past
 * `MAX_SUBTASK_DEPTH`, and the depth column here stops the walk regardless, so
 * a cycle that somehow reached the table could not hang a page.
 */
export async function listSubtaskTree(rootId: string, maxDepth = 8): Promise<TaskCard[]> {
  return runTaskQuery(
    sql`k.id in (
      with recursive branch as (
        select id, 1 as depth from tasks where parent_id = ${rootId}
        union all
        select t.id, b.depth + 1
        from tasks t join branch b on t.parent_id = b.id
        where b.depth < ${maxDepth}
      )
      select id from branch
    )`,
    500,
    byDueDate,
    { containers: true },
  );
}

/**
 * The chain from the root down to this task's parent, outermost first.
 *
 * One level used to be the whole story, so a task knew its parent's title and
 * that was the way out. At depth you need the path, or "back" lands you
 * somewhere you cannot place.
 */
export async function listAncestors(taskId: string): Promise<{ id: string; title: string }[]> {
  const result = await db.execute(sql`
    with recursive up as (
      select t.id, t.title, t.parent_id, 0 as depth
      from tasks t where t.id = ${taskId}
      union all
      select p.id, p.title, p.parent_id, up.depth + 1
      from tasks p join up on p.id = up.parent_id
      where up.depth < 16
    )
    select id, title from up where id <> ${taskId} order by depth desc
  `);
  return result.rows as { id: string; title: string }[];
}

/**
 * How far below a root a task sits. Zero is a task nobody has filed under
 * anything; one is a piece of it.
 *
 * Depth is a cross-row property, so Postgres cannot express it as a constraint
 * without a trigger and this codebase has none. It is asked for at the one
 * moment it matters — the instant before another level is created.
 */
export async function depthOf(taskId: string): Promise<number> {
  const result = await db.execute(sql`
    with recursive up as (
      select t.id, t.parent_id, 0 as depth from tasks t where t.id = ${taskId}
      union all
      select p.id, p.parent_id, up.depth + 1
      from tasks p join up on p.id = up.parent_id
      where up.depth < 16
    )
    select max(depth) as depth from up
  `);
  return Number((result.rows[0] as { depth: number | null })?.depth ?? 0);
}
