import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dayRange, now, pct, type Zone } from "@/lib/date";
import { isBlocked, isLeaf, onTimeIn, overdueSql, scopeSql, type Scope } from "./sql";
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
  zone?: Zone,
): Promise<AttentionItem[]> {
  const { start, end } = dayRange(reference, zone);
  const where = scopeSql(scope);
  const items: AttentionItem[] = [];

  // 1. Who is carrying the most work past its due date.
  const overdue = await db.execute(sql`
    select u.id, u.name, count(*) as n
    from tasks k
    join task_assignees a on a.task_id = k.id
    join users u on u.id = a.user_id
    where ${where} and ${isLeaf} and ${overdueSql(start)}
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
      href: `/account/${r.id}`,
    });
  }

  /*
   * 2. Work landing in the next two hours that has not been started.
   *
   * "Not started" is the board's first column by position, whatever it is
   * called — a board that renames To Do to "Backlog" still counts here. It
   * used to be the first column of kind `open`, which was the same thing only
   * while boards were three columns deep; on a board that opens with a
   * client-facing stage the first column is where work waits regardless of
   * how it is classified.
   */
  const soon = await db.execute(sql`
    select count(*) as n from tasks k
    join board_statuses s on s.id = k.status_id
    where ${where} and ${isLeaf} and k.completed_at is null
      and s.position = (
        select min(s2.position) from board_statuses s2
        where s2.board_id = k.board_id
      )
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
    where ${where} and ${isLeaf} and k.completed_at is null and k.due_date < ${end}
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

  // 4. Blocked work needs a person, not a chart. A board may call the column
  // anything; `kind` is what makes it blocked.
  const blocked = await db.execute(sql`
    select count(*) as n from tasks k
    join board_statuses s on s.id = k.status_id
    where ${where} and ${isLeaf} and ${isBlocked}
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
 * Department-level signals the Senior Director cannot get from an account view:
 * an account's week-over-week slide, and the weakest kind of work.
 */
export async function getDepartmentAttention(
  reference: Date = now(),
  zone?: Zone,
): Promise<AttentionItem[]> {
  const { start } = dayRange(reference, zone);
  const weekStart = new Date(start.getTime() - 6 * 86_400_000);
  const priorStart = new Date(start.getTime() - 13 * 86_400_000);
  const items: AttentionItem[] = [];

  const trend = await db.execute(sql`
    select t.id, t.name,
      count(*) filter (where k.due_date >= ${weekStart}) as week_due,
      count(*) filter (where k.due_date >= ${weekStart} and ${onTimeIn(zone)}) as week_done,
      count(*) filter (where k.due_date >= ${priorStart} and k.due_date < ${weekStart}) as prior_due,
      count(*) filter (where k.due_date >= ${priorStart} and k.due_date < ${weekStart} and ${onTimeIn(zone)}) as prior_done
    from accounts t
    join tasks k on k.account_id = t.id and ${isLeaf} and k.due_date >= ${priorStart}
    group by t.id, t.name
  `);

  /*
   * The two steepest slides, not every account that slipped.
   *
   * With two teams this could push at most two items; with five accounts — and
   * a department where a bad week moves most of them together — it filled all
   * four slots on `/accounts` and buried both the weakest-work signal and
   * every person-level one. A list of five things all saying "down a bit" is
   * not a list of exceptions, it is the trend chart again in words.
   */
  const slides = (trend.rows as Record<string, string>[])
    .map((r) => {
      const thisWeek = pct(Number(r.week_done), Number(r.week_due));
      const lastWeek = pct(Number(r.prior_done), Number(r.prior_due));
      return { id: r.id, name: r.name, delta: thisWeek - lastWeek };
    })
    .filter((row) => row.delta <= -5)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 2);

  for (const row of slides) {
    items.push({
      severity: row.delta <= -10 ? "high" : "medium",
      headline: row.name,
      detail: `Completion down ${Math.abs(row.delta)}% vs last week`,
      href: `/accounts/${row.id}`,
    });
  }

  const byType = await db.execute(sql`
    select ty.name as type, count(*) as due, count(*) filter (where ${onTimeIn(zone)}) as done
    from tasks k
    join task_types ty on ty.id = k.type_id
    where ${isLeaf} and k.due_date >= ${weekStart}
    group by ty.id, ty.name
    having count(*) > 20
    order by (count(*) filter (where ${onTimeIn(zone)}))::numeric / count(*) asc
    limit 1
  `);
  const worst = byType.rows[0] as Record<string, string> | undefined;
  if (worst) {
    items.push({
      severity: "medium",
      headline: worst.type,
      detail: `Lowest completion this week — ${pct(Number(worst.done), Number(worst.due))}%`,
    });
  }

  return items;
}
