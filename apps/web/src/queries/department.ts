import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dayRange, now, pct, type Zone } from "@/lib/date";
import { isLeaf, onTimeIn } from "./sql";

export type TeamSummary = {
  id: string;
  name: string;
  directorName: string | null;
  headcount: number;
  due: number;
  done: number;
  overdue: number;
  percent: number;
  /** Completion over the last 7 days, and the 7 days before that. */
  weekPercent: number;
  priorWeekPercent: number;
};

export type DepartmentToday = {
  headcount: number;
  due: number;
  done: number;
  overdue: number;
  percent: number;
  /** Completion over the last 7 days, and the 7 days before that. */
  weekPercent: number;
  priorWeekPercent: number;
  teams: TeamSummary[];
};

/** Screen 4. One pass over both teams — the SD view is a comparison, not a sum. */
export async function getDepartmentToday(
  reference: Date = now(),
  zone?: Zone,
): Promise<DepartmentToday> {
  const { start, end } = dayRange(reference, zone);
  const weekStart = new Date(start.getTime() - 6 * 86_400_000);
  const priorStart = new Date(start.getTime() - 13 * 86_400_000);

  const rows = await db.execute(sql`
    with dued as (
      select k.team_id,
             count(*) filter (where k.due_date >= ${start} and k.due_date < ${end}) as due,
             count(*) filter (where k.due_date >= ${start} and k.due_date < ${end} and k.completed_at is not null) as done,
             count(*) filter (where k.due_date < ${start} and k.completed_at is null) as overdue,
             count(*) filter (where k.due_date >= ${weekStart} and k.due_date < ${end}) as week_due,
             count(*) filter (where k.due_date >= ${weekStart} and k.due_date < ${end}
                              and ${onTimeIn(zone)}) as week_done,
             count(*) filter (where k.due_date >= ${priorStart} and k.due_date < ${weekStart}) as prior_due,
             count(*) filter (where k.due_date >= ${priorStart} and k.due_date < ${weekStart}
                              and ${onTimeIn(zone)}) as prior_done
      from tasks k where ${isLeaf} group by k.team_id
    )
    select t.id, t.name, d.name as director_name,
           (select count(*) from users u where u.team_id = t.id) as headcount,
           coalesce(dued.due, 0) as due, coalesce(dued.done, 0) as done,
           coalesce(dued.overdue, 0) as overdue,
           coalesce(dued.week_due, 0) as week_due, coalesce(dued.week_done, 0) as week_done,
           coalesce(dued.prior_due, 0) as prior_due, coalesce(dued.prior_done, 0) as prior_done
    from teams t
    left join users d on d.id = t.account_director_id
    left join dued on dued.team_id = t.id
    order by t.name
  `);

  const raw = rows.rows as Record<string, string>[];

  const teams: TeamSummary[] = raw.map((r) => ({
    id: r.id,
    name: r.name,
    directorName: r.director_name,
    headcount: Number(r.headcount),
    due: Number(r.due),
    done: Number(r.done),
    overdue: Number(r.overdue),
    percent: pct(Number(r.done), Number(r.due)),
    weekPercent: pct(Number(r.week_done), Number(r.week_due)),
    priorWeekPercent: pct(Number(r.prior_done), Number(r.prior_due)),
  }));

  const headRow = await db.execute(sql`select count(*) as n from users`);
  const headcount = Number((headRow.rows[0] as { n: string }).n);

  const due = teams.reduce((n, t) => n + t.due, 0);
  const done = teams.reduce((n, t) => n + t.done, 0);

  // Department rates are recomputed from the raw counts. Averaging the two
  // teams' percentages would weight a 14-person team the same as a 15-person
  // one and quietly produce a number that is nobody's.
  const sum = (key: string) => raw.reduce((n, r) => n + Number(r[key]), 0);

  return {
    headcount,
    due,
    done,
    overdue: teams.reduce((n, t) => n + t.overdue, 0),
    percent: pct(done, due),
    weekPercent: pct(sum("week_done"), sum("week_due")),
    priorWeekPercent: pct(sum("prior_done"), sum("prior_due")),
    teams,
  };
}
