import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { APP_TIMEZONE } from "@/lib/date";

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

export const TZ = APP_TIMEZONE;

/**
 * The brief's completion definition: a task counts only if it was finished by
 * the end of the day it was due. Backlog never flatters today's number.
 */
export const onTime = sql`(k.completed_at is not null and k.completed_at < ((date_trunc('day', k.due_date at time zone ${TZ}) + interval '1 day') at time zone ${TZ}))`;

/**
 * Overdue means carried over from an earlier day. Today's unfinished work is
 * "remaining", not overdue — otherwise every evening reads as a crisis.
 */
export const overdueSql = (todayStart: Date): SQL =>
  sql`(k.due_date < ${todayStart} and k.completed_at is null)`;

/** Task row plus its assignees and tags, ready to render. */
export type TaskCard = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  dueDate: Date;
  completedAt: Date | null;
  teamId: string;
  createdBy: string;
  assignees: { id: string; name: string }[];
  tags: string[];
};

/** Shared projection so every list screen renders identical task shapes. */
export const taskCardSelect = sql`
  k.id, k.title, k.description, k.type, k.status, k.priority,
  k.due_date as "dueDate", k.completed_at as "completedAt",
  k.team_id as "teamId", k.created_by as "createdBy",
  coalesce(
    (select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name) order by u.name)
     from task_assignees a join users u on u.id = a.user_id where a.task_id = k.id),
    '[]'::jsonb
  ) as assignees,
  coalesce(
    (select jsonb_agg(g.name order by g.name)
     from task_tags tt join tags g on g.id = tt.tag_id where tt.task_id = k.id),
    '[]'::jsonb
  ) as tags
`;

/** Ordering used everywhere a task list is shown. */
export const taskOrder = sql`
  case k.priority when 'urgent' then 0 when 'high' then 1 else 2 end,
  k.due_date asc
`;
