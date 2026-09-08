import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { APP_TIMEZONE } from "@/lib/date";
import type { StatusKind } from "@/db/schema";

/**
 * Statuses are per-board and user-named, so anything shared has to key off
 * `kind`. `s` is the `board_statuses` row every task query joins.
 */
export const isBlocked = sql`s.kind = 'blocked'`;

/**
 * Every query in the app is scoped one of three ways. Keeping the scope as a
 * single composable SQL fragment means the person, team and department views
 * all count the same things the same way.
 */
export type Scope =
  | { kind: "department" }
  | { kind: "team"; teamId: string }
  | { kind: "user"; userId: string };

export const departmentScope: Scope = { kind: "department" };
export const teamScope = (teamId: string): Scope => ({ kind: "team", teamId });
export const userScope = (userId: string): Scope => ({ kind: "user", userId });

/** Applied to a `tasks` row aliased as `k`. */
export function scopeSql(scope: Scope): SQL {
  switch (scope.kind) {
    case "team":
      return sql`k.team_id = ${scope.teamId}`;
    case "user":
      return sql`exists (select 1 from task_assignees sa where sa.task_id = k.id and sa.user_id = ${scope.userId})`;
    default:
      return sql`true`;
  }
}

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
 * lists, but `team.ts`, `department.ts`, `reports.ts` and `attention.ts` each
 * write `from tasks k` directly — so filtering the shared path alone would fix
 * every list and leave every number wrong.
 */
export const isLeaf = sql`not exists (select 1 from tasks c where c.parent_id = k.id)`;

export const overdueSql = (todayStart: Date): SQL =>
  sql`(k.due_date < ${todayStart} and k.completed_at is null)`;

/** Task row plus its assignees and tags, ready to render. */
export type TaskCard = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  dueDate: Date;
  estimateMinutes: number | null;
  actualMinutes: number | null;
  completedAt: Date | null;
  teamId: string;
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
  k.id, k.title, k.description, k.type, k.priority,
  k.due_date as "dueDate", k.completed_at as "completedAt",
  k.estimate_minutes as "estimateMinutes", k.actual_minutes as "actualMinutes",
  k.team_id as "teamId", k.created_by as "createdBy",
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
   * Scoped to the task's own team rather than the reader's, because this
   * projection has no reader — threading one through would touch every list
   * query in the app. So a document from another team, attached by the one
   * role that can see both, is not counted on the row; the task page lists it
   * correctly. Undercounting for a Senior Director beats leaking a count to
   * everybody else.
   */
  (select count(distinct td.document_id)
   from task_documents td join documents dd on dd.id = td.document_id
   where td.task_id = k.id
     and (dd.visibility = 'org' or dd.team_id = k.team_id))::int as docs
`;

/** Ordering used everywhere a task list is shown. */
export const taskOrder = sql`
  case k.priority when 'urgent' then 0 when 'high' then 1 else 2 end,
  k.due_date asc
`;

/** The joins `taskCardSelect` depends on. Kept next to it so they cannot drift. */
export const taskCardFrom = sql`
  from tasks k
  join board_statuses s on s.id = k.status_id
  join boards b on b.id = k.board_id
`;

/** Applied to a `tasks` row aliased as `k`. */
export const boardScopeSql = (boardId: string): SQL => sql`k.board_id = ${boardId}`;
