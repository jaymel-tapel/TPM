import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dayRange, now, pct } from "@/lib/date";
import { onTime, overdueSql, scopeSql, type Scope } from "./sql";
import { TASK_TYPE_LABELS } from "@/lib/constants";
import type { TaskType } from "@/db/schema";

export type AttentionItem = {
  severity: "high" | "medium";
  headline: string;
  detail: string;
  href?: string;
};

const MAX_ITEMS = 4;

/**
 * The brief asks leadership to be told what needs attention rather than handed
 * charts to interpret. Each signal is a plain sentence with somewhere to click.
 */
export async function getNeedsAttention(
  scope: Scope,
  reference: Date = now(),
): Promise<AttentionItem[]> {
  const { start, end } = dayRange(reference);
  const where = scopeSql(scope);
  const items: AttentionItem[] = [];

  // 1. Who is carrying the most work past its due date.
  const overdue = await db.execute(sql`
    select u.id, u.name, count(*) as n
    from tasks k
    join task_assignees a on a.task_id = k.id
    join users u on u.id = a.user_id
    where ${where} and ${overdueSql(start)}
    group by u.id, u.name
    order by n desc, u.name
    limit 2
  `);
  for (const r of overdue.rows as { id: string; name: string; n: string }[]) {
    if (Number(r.n) < 2) continue;
    items.push({
      severity: Number(r.n) >= 5 ? "high" : "medium",
      headline: r.name,
      detail: `${r.n} overdue ${Number(r.n) === 1 ? "task" : "tasks"}`,
      href: `/team/${r.id}`,
    });
  }

  // 2. Work landing in the next two hours that has not been started.
  const soon = await db.execute(sql`
    select count(*) as n from tasks k
    where ${where} and k.status = 'todo' and k.completed_at is null
      and k.due_date between now() and now() + interval '2 hours'
  `);
  const soonCount = Number((soon.rows[0] as { n: string }).n);
  if (soonCount > 0) {
    items.push({
      severity: "medium",
      headline: `${soonCount} ${soonCount === 1 ? "task" : "tasks"} due within 2 hours`,
      detail: "Not started yet",
    });
  }

  // 3. Shared work is the easiest to let slip, so it gets its own line.
  const collab = await db.execute(sql`
    select count(*) as n from tasks k
    where ${where} and k.completed_at is null and k.due_date < ${end}
      and (select count(*) from task_assignees a where a.task_id = k.id) > 1
  `);
  const collabCount = Number((collab.rows[0] as { n: string }).n);
  if (collabCount > 0) {
    items.push({
      severity: "medium",
      headline: `${collabCount} collaborative ${collabCount === 1 ? "task" : "tasks"}`,
      detail: "Still incomplete",
    });
  }

  // 4. Blocked work needs a person, not a chart.
  const blocked = await db.execute(sql`
    select count(*) as n from tasks k where ${where} and k.status = 'blocked'
  `);
  const blockedCount = Number((blocked.rows[0] as { n: string }).n);
  if (blockedCount > 0) {
    items.push({
      severity: "high",
      headline: `${blockedCount} blocked ${blockedCount === 1 ? "task" : "tasks"}`,
      detail: "Waiting on something",
    });
  }

  return items.slice(0, MAX_ITEMS);
}

/**
 * Department-level signals the Senior Director cannot get from a team view:
 * a team's week-over-week slide, and the weakest kind of work.
 */
export async function getDepartmentAttention(reference: Date = now()): Promise<AttentionItem[]> {
  const { start } = dayRange(reference);
  const weekStart = new Date(start.getTime() - 6 * 86_400_000);
  const priorStart = new Date(start.getTime() - 13 * 86_400_000);
  const items: AttentionItem[] = [];

  const trend = await db.execute(sql`
    select t.id, t.name,
      count(*) filter (where k.due_date >= ${weekStart}) as week_due,
      count(*) filter (where k.due_date >= ${weekStart} and ${onTime}) as week_done,
      count(*) filter (where k.due_date >= ${priorStart} and k.due_date < ${weekStart}) as prior_due,
      count(*) filter (where k.due_date >= ${priorStart} and k.due_date < ${weekStart} and ${onTime}) as prior_done
    from teams t
    join tasks k on k.team_id = t.id and k.due_date >= ${priorStart}
    group by t.id, t.name
  `);

  for (const r of trend.rows as Record<string, string>[]) {
    const thisWeek = pct(Number(r.week_done), Number(r.week_due));
    const lastWeek = pct(Number(r.prior_done), Number(r.prior_due));
    const delta = thisWeek - lastWeek;
    if (delta <= -5) {
      items.push({
        severity: delta <= -10 ? "high" : "medium",
        headline: r.name,
        detail: `Completion down ${Math.abs(delta)}% vs last week`,
        href: `/teams/${r.id}`,
      });
    }
  }

  const byType = await db.execute(sql`
    select k.type, count(*) as due, count(*) filter (where ${onTime}) as done
    from tasks k
    where k.due_date >= ${weekStart}
    group by k.type
    having count(*) > 20
    order by (count(*) filter (where ${onTime}))::numeric / count(*) asc
    limit 1
  `);
  const worst = byType.rows[0] as Record<string, string> | undefined;
  if (worst) {
    items.push({
      severity: "medium",
      headline: TASK_TYPE_LABELS[worst.type as TaskType],
      detail: `Lowest completion this week — ${pct(Number(worst.done), Number(worst.due))}%`,
    });
  }

  return items;
}
