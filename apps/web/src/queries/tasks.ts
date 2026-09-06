import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dayRange, now, pct } from "@/lib/date";
import {
  overdueSql,
  scopeSql,
  taskCardSelect,
  taskOrder,
  userScope,
  type Scope,
  type TaskCard,
} from "./sql";

async function runTaskQuery(where: ReturnType<typeof sql>, limit = 300) {
  const result = await db.execute(
    sql`select ${taskCardSelect} from tasks k where ${where} order by ${taskOrder} limit ${limit}`,
  );
  return result.rows as unknown as TaskCard[];
}

export type DayView = {
  today: TaskCard[];
  completed: TaskCard[];
  overdue: TaskCard[];
  due: number;
  done: number;
  percent: number;
};

/**
 * Screen 1. Splits the day into what's left, what's finished, and anything
 * that slipped from an earlier day — the three questions the brief asks.
 */
export async function getDayView(userId: string, reference = now()): Promise<DayView> {
  const { start, end } = dayRange(reference);
  const scope = scopeSql(userScope(userId));

  const dueToday = await runTaskQuery(
    sql`${scope} and k.due_date >= ${start} and k.due_date < ${end}`,
  );
  const overdue = await runTaskQuery(
    sql`${scope} and k.due_date < ${start} and k.completed_at is null`,
    50,
  );

  const completed = dueToday.filter((t) => t.completedAt !== null);
  const today = dueToday.filter((t) => t.completedAt === null);

  return {
    today,
    completed,
    overdue,
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

/** Backs /my-tasks and the team list — compact chips, not a query builder. */
export async function listTasks(
  scope: Scope,
  filters: TaskFilters = {},
  reference = now(),
): Promise<TaskCard[]> {
  const { start, end } = dayRange(reference);
  const clauses = [scopeSql(scope)];

  if (filters.status) clauses.push(sql`k.status = ${filters.status}`);
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
