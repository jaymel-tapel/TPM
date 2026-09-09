import "server-only";
import { sql } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/db";
import { dayRange, now, pct, type Zone } from "@/lib/date";
import { isLeaf, onTimeIn, overdueSql, scopeSql, TZ, type Scope } from "./sql";
import type { TaskTypeRef } from "@meridian/ui";

export type ReportMetrics = {
  due: number;
  completed: number;
  completionRate: number;
  onTimeRate: number;
  overdue: number;
  /** Hours from creation to completion, averaged over the window. */
  avgCompletionHours: number | null;
};

function windowBounds(days: number, reference: Date = now(), zone: Zone = TZ) {
  const { end } = dayRange(reference, zone);
  return { start: new Date(end.getTime() - days * 86_400_000), end };
}

/**
 * Screen 5's headline numbers. `completionRate` is the brief's definition —
 * tasks due in the window that were finished by end of their own due day.
 */
export async function getReportMetrics(
  scope: Scope,
  days = 7,
  reference: Date = now(),
  zone: Zone = TZ,
): Promise<ReportMetrics> {
  const { start, end } = windowBounds(days, reference, zone);
  const todayStart = dayRange(reference, zone).start;
  const where = scopeSql(scope);

  const rows = await db.execute(sql`
    select
      count(*) filter (where k.due_date >= ${start} and k.due_date < ${end}) as due,
      count(*) filter (where k.due_date >= ${start} and k.due_date < ${end} and k.completed_at is not null) as completed,
      count(*) filter (where k.due_date >= ${start} and k.due_date < ${end} and ${onTimeIn(zone)}) as on_time,
      count(*) filter (where ${overdueSql(todayStart)}) as overdue,
      avg(extract(epoch from (k.completed_at - k.created_at)) / 3600)
        filter (where k.completed_at is not null and k.due_date >= ${start} and k.due_date < ${end}) as avg_hours
    from tasks k
    where ${where} and ${isLeaf}
  `);

  const r = rows.rows[0] as Record<string, string | null>;
  const due = Number(r.due);
  return {
    due,
    completed: Number(r.completed),
    completionRate: pct(Number(r.on_time), due),
    onTimeRate: pct(Number(r.on_time), Number(r.completed) || 0),
    overdue: Number(r.overdue),
    avgCompletionHours: r.avg_hours === null ? null : Number(r.avg_hours),
  };
}

export type TrendPoint = { date: Date; label: string; due: number; done: number; percent: number };

/** One clean series — the only chart in the product. */
export async function getCompletionTrend(
  scope: Scope,
  days = 7,
  reference: Date = now(),
  zone: Zone = TZ,
): Promise<TrendPoint[]> {
  const { start } = dayRange(reference, zone);
  const first = new Date(start.getTime() - (days - 1) * 86_400_000);
  const where = scopeSql(scope);

  const rows = await db.execute(sql`
    with span as (
      select generate_series(
        (${first} at time zone ${zone})::date,
        (${start} at time zone ${zone})::date,
        interval '1 day'
      )::date as d
    )
    select span.d,
      count(k.id) as due,
      count(k.id) filter (where ${onTimeIn(zone)}) as done
    from span
    left join tasks k
      on k.due_date >= (span.d::timestamp at time zone ${zone})
     and k.due_date <  ((span.d + 1)::timestamp at time zone ${zone})
     and ${where} and ${isLeaf}
    group by span.d
    order by span.d
  `);
  // pg returns a `date` column as a Date at local midnight, which is already
  // the right calendar day — no timezone shifting needed for the label.
  return (rows.rows as { d: Date; due: string; done: string }[]).map((r) => {
    const date = new Date(r.d);
    const due = Number(r.due);
    const done = Number(r.done);
    return {
      date,
      label: format(date, "EEE"),
      due,
      done,
      // A day with nothing due reads as 0% on the trend rather than a
      // misleading 100% spike.
      percent: due === 0 ? 0 : Math.round((done / due) * 100),
    };
  });
}

export type TypeBreakdown = { type: TaskTypeRef; due: number; done: number; percent: number };

export async function getCompletionByType(
  scope: Scope,
  days = 7,
  reference: Date = now(),
  zone: Zone = TZ,
): Promise<TypeBreakdown[]> {
  const { start, end } = windowBounds(days, reference, zone);
  const where = scopeSql(scope);

  /*
   * Grouped by the type row, not by the enum column: a kind people can rename
   * has to report under the name it has now, and two kinds that happen to
   * share a fallback slug must not collapse into one bar.
   */
  const rows = await db.execute(sql`
    select ty.slug, ty.name, ty.icon, ty.tone,
           count(*) as due, count(*) filter (where ${onTimeIn(zone)}) as done
    from tasks k
    join task_types ty on ty.id = k.type_id
    where ${where} and ${isLeaf} and k.due_date >= ${start} and k.due_date < ${end}
    group by ty.id, ty.slug, ty.name, ty.icon, ty.tone
    order by ty.name
  `);

  return (rows.rows as Record<string, string>[])
    .map((r) => {
      const due = Number(r.due);
      const done = Number(r.done);
      return {
        type: { slug: r.slug, label: r.name, icon: r.icon, tone: r.tone },
        due,
        done,
        percent: pct(done, due),
      };
    })
    .sort((a, b) => a.percent - b.percent);
}

export type WorkloadRow = { id: string; name: string; accountName: string | null; due: number; done: number; percent: number };

export async function getWorkload(
  scope: Scope,
  days = 7,
  reference: Date = now(),
  zone: Zone = TZ,
): Promise<WorkloadRow[]> {
  const { start, end } = windowBounds(days, reference, zone);
  const where = scopeSql(scope);

  /*
   * The accounts are a subquery rather than a join now. Joining would multiply
   * a person by their memberships and count their work once per account — and
   * an inner join, which is what this was, would silently drop anybody on no
   * account at all.
   */
  const rows = await db.execute(sql`
    select u.id, u.name,
           (select string_agg(a.name, ', ' order by a.name)
            from account_members m join accounts a on a.id = m.account_id
            where m.user_id = u.id) as account_name,
           count(k.id) as due,
           count(k.id) filter (where ${onTimeIn(zone)}) as done
    from users u
    left join task_assignees a on a.user_id = u.id
    left join tasks k on k.id = a.task_id and ${isLeaf} and k.due_date >= ${start} and k.due_date < ${end} and ${where}
    group by u.id, u.name
    order by count(k.id) desc, u.name
  `);

  return (rows.rows as Record<string, string>[]).map((r) => {
    const due = Number(r.due);
    const done = Number(r.done);
    return { id: r.id, name: r.name, accountName: r.account_name, due, done, percent: pct(done, due) };
  });
}
