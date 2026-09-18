import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { APP_TIMEZONE } from "@/lib/date";
import type { TaskTypeRef } from "@tpm/ui";
import type { StatusKind } from "@/db/schema";

/**
 * Statuses are per-board and user-named, so anything shared has to key off
 * `kind`. `s` is the `board_statuses` row every task query joins.
 */
export const isBlocked = sql`s.kind = 'blocked'`;

/**
 * Every query in the app is scoped one of a few ways. Keeping the scope as a
 * single composable SQL fragment means the person, account, campaign and
 * department views all count the same things the same way.
 */
export type Scope =
  | { kind: "department" }
  | { kind: "account"; accountId: string }
  | { kind: "campaign"; campaignId: string }
  | { kind: "user"; userId: string }
  /** One person's work inside one account — a roster row on an account page. */
  | { kind: "userInAccount"; userId: string; accountId: string };

export const departmentScope: Scope = { kind: "department" };
export const accountScope = (accountId: string): Scope => ({ kind: "account", accountId });
export const campaignScope = (campaignId: string): Scope => ({ kind: "campaign", campaignId });
export const userScope = (userId: string): Scope => ({ kind: "user", userId });
export const userInAccountScope = (userId: string, accountId: string): Scope => ({
  kind: "userInAccount",
  userId,
  accountId,
});

/** Whether the task aliased as `k` is one of this person's. */
const assignedTo = (userId: string): SQL =>
  sql`exists (select 1 from task_assignees sa where sa.task_id = k.id and sa.user_id = ${userId})`;

/**
 * Applied to a `tasks` row aliased as `k`.
 *
 * Every arm is written out and there is no `default`. There used to be one,
 * returning `true` — so a scope nobody had handled quietly widened to the whole
 * department instead of failing to compile. That is the wrong direction for a
 * mistake to fall in a product where the scope *is* the permission, and adding
 * three arms at once is exactly when it would have bitten.
 */
export function scopeSql(scope: Scope): SQL {
  switch (scope.kind) {
    case "department":
      return sql`true`;
    case "account":
      return sql`k.account_id = ${scope.accountId}`;
    case "campaign":
      return sql`k.campaign_id = ${scope.campaignId}`;
    case "user":
      return assignedTo(scope.userId);
    case "userInAccount":
      return sql`(k.account_id = ${scope.accountId} and ${assignedTo(scope.userId)})`;
  }
  const impossible: never = scope;
  throw new Error(`Unhandled scope: ${JSON.stringify(impossible)}`);
}

/** A list of ids as a SQL `in (...)` body, each cast so Postgres can compare it. */
export const uuids = (ids: string[]) =>
  sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );

/**
 * Whether a `users` row aliased as `u` works on this account.
 *
 * Membership is a table now, so "is this person on that account" is an
 * `exists` rather than a column comparison. Kept here beside `scopeSql` so
 * every query asks it the same way — the copies are what drift.
 */
export const worksOn = (accountId: string | null): SQL =>
  accountId === null
    ? sql`false`
    : sql`exists (select 1 from account_members m where m.user_id = u.id and m.account_id = ${accountId}::uuid)`;

/** Whether `u` works on any of these accounts. An empty list matches nobody. */
export const worksOnAny = (accountIds: string[]): SQL =>
  accountIds.length === 0
    ? sql`false`
    : sql`exists (select 1 from account_members m where m.user_id = u.id and m.account_id in (${sql.join(
        accountIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}))`;

/** The department's zone, and the fallback when a reader has not set one. */
export const TZ = APP_TIMEZONE;

/**
 * The brief's completion definition: a task counts only if it was finished by
 * the end of the day it was due. Backlog never flatters today's number.
 *
 * Takes the *reader's* zone, because that is what decides when the due day
 * ended. Someone in Manila and someone in London can therefore disagree about
 * whether the same task was on time, and both are right — a day boundary
 * belongs to whoever is reckoning it.
 */
export const onTimeIn = (zone: string = TZ) =>
  sql`(k.completed_at is not null and k.completed_at < ((date_trunc('day', k.due_date at time zone ${zone}) + interval '1 day') at time zone ${zone}))`;

/**
 * Overdue means carried over from an earlier day. Today's unfinished work is
 * "remaining", not overdue — otherwise every evening reads as a crisis.
 */
/**
 * A task nobody has broken down — the unit of work.
 *
 * Every count and every list of work is filtered by this, so that splitting a
 * task into three parts changes what the day *looks like* without changing how
 * much there is to do. A task with children is a container; its children are
 * the work.
 *
 * It has to be applied in two places, not one. `runTaskQuery` covers the
 * lists, but `account.ts`, `department.ts`, `reports.ts` and `attention.ts` each
 * write `from tasks k` directly — so filtering the shared path alone would fix
 * every list and leave every number wrong.
 */
export const isLeaf = sql`not exists (select 1 from tasks c where c.parent_id = k.id)`;

export const overdueSql = (todayStart: Date): SQL =>
  sql`(k.due_date < ${todayStart} and k.completed_at is null)`;

/**
 * The slice of a board's work a board actually shows: due today, carried over
 * from an earlier day, or finished today.
 *
 * Named because two places have to agree on it. `getBoardView` reads it, and
 * `moveTask` has to rank the same set — a drop rearranges the column the
 * reader was looking at, and ranking rows outside that window would both cost
 * writes nobody asked for and give a rank to work nobody can see.
 */
export const boardWindowSql = (start: Date, end: Date): SQL =>
  sql`(
    (k.due_date >= ${start} and k.due_date < ${end})
    or ${overdueSql(start)}
    or (k.completed_at >= ${start} and k.completed_at < ${end})
  )`;

/** Task row plus its assignees and tags, ready to render. */
export type TaskCard = {
  id: string;
  title: string;
  description: string | null;
  type: TaskTypeRef;
  priority: string;
  dueDate: Date;
  estimateMinutes: number | null;
  actualMinutes: number | null;
  completedAt: Date | null;
  accountId: string | null;
  /** The client's name, for lists that span more than one. */
  accountName: string | null;
  campaignId: string | null;
  boardId: string;
  boardName: string;
  createdBy: string;
  /** The task this is a piece of, and its title for the breadcrumb. */
  parentId: string | null;
  parentTitle: string | null;
  /** How many pieces this task was broken into, and how many are finished. */
  childCount: number;
  childrenDone: number;
  /**
   * The column this task is in. `name` is whatever the board's owner called
   * it; `kind` is the only part any query is allowed to reason about.
   */
  statusId: string;
  statusName: string;
  statusKind: StatusKind;
  assignees: { id: string; name: string }[];
  tags: string[];
  /** How many documents this task references, however it references them. */
  docs: number;
};

/**
 * Shared projection so every list screen renders identical task shapes.
 * Assumes `tasks k join board_statuses s ... join boards b ...` — see
 * `taskCardFrom`.
 */
export const taskCardSelect = sql`
  k.id, k.title, k.description, k.priority,
  /*
   * Resolved here rather than in the component, because the kinds are rows
   * people can add now and a component cannot look one up.
   *
   * A CASE rather than a coalesce: the join is left, and an all-null row still
   * builds a perfectly good jsonb object full of nulls, so there would be
   * nothing for coalesce to reject. The fallback reads the enum column that is
   * still there, which is what makes a task with no type_id render rather than
   * vanish from a list.
   */
  case when ty.id is null
    then jsonb_build_object('slug', k.type::text, 'label', k.type::text,
                            'icon', 'clipboard-list', 'tone', 'gray')
    else jsonb_build_object('slug', ty.slug, 'label', ty.name,
                            'icon', ty.icon, 'tone', ty.tone)
  end as "type",
  k.due_date as "dueDate", k.completed_at as "completedAt",
  k.estimate_minutes as "estimateMinutes", k.actual_minutes as "actualMinutes",
  k.account_id as "accountId",
  (select a.name from accounts a where a.id = k.account_id) as "accountName",
  k.campaign_id as "campaignId", k.created_by as "createdBy",
  k.parent_id as "parentId",
  (select p.title from tasks p where p.id = k.parent_id) as "parentTitle",
  (select count(*) from tasks c where c.parent_id = k.id)::int as "childCount",
  (select count(*) from tasks c where c.parent_id = k.id and c.completed_at is not null)::int as "childrenDone",
  k.board_id as "boardId", b.name as "boardName",
  k.status_id as "statusId", s.name as "statusName", s.kind as "statusKind",
  coalesce(
    (select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name) order by u.name)
     from task_assignees a join users u on u.id = a.user_id where a.task_id = k.id),
    '[]'::jsonb
  ) as assignees,
  coalesce(
    (select jsonb_agg(g.name order by g.name)
     from task_tags tt join tags g on g.id = tt.tag_id where tt.task_id = k.id),
    '[]'::jsonb
  ) as tags,
  /*
   * Scoped to the task's own account rather than the reader's, because this
   * projection has no reader — threading one through would touch every list
   * query in the app. So a document from another account, attached by the one
   * role that can see both, is not counted on the row; the task page lists it
   * correctly. Undercounting for a Senior Director beats leaking a count to
   * everybody else.
   */
  (select count(distinct td.document_id)
   from task_documents td join documents dd on dd.id = td.document_id
   where td.task_id = k.id
     and (dd.visibility = 'org' or dd.account_id = k.account_id))::int as docs
`;

/** Ordering used everywhere a task list is shown. */
export const taskOrder = sql`
  case k.priority when 'urgent' then 0 when 'high' then 1 else 2 end,
  k.due_date asc
`;

/**
 * The board's order, and only the board's.
 *
 * A card somebody placed keeps the place they put it. Everything nobody has
 * placed follows `taskOrder` underneath it — `position = 0` means "nobody has
 * said", which is why it sorts *last* rather than first: work created into a
 * column, or drifting into the board's day window when its date changes, must
 * not land on top of an arrangement somebody made.
 *
 * A column nobody has dragged in is therefore all zeroes, and reads exactly as
 * it always did. Lists keep `taskOrder` untouched: a list has no columns to
 * arrange, and nothing outside `getBoardView` reads `position` at all.
 */
export const boardOrder = sql`
  case when k.position = 0 then 1 else 0 end,
  k.position asc,
  ${taskOrder}
`;

/** The joins `taskCardSelect` depends on. Kept next to it so they cannot drift. */
export const taskCardFrom = sql`
  from tasks k
  join board_statuses s on s.id = k.status_id
  join boards b on b.id = k.board_id
  left join task_types ty on ty.id = k.type_id
`;

/** Applied to a `tasks` row aliased as `k`. */
export const boardScopeSql = (boardId: string): SQL => sql`k.board_id = ${boardId}`;
