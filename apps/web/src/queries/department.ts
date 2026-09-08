import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dayRange, now, pct, type Zone } from "@/lib/date";
import { isLeaf, onTimeIn, uuids } from "./sql";

export type AccountSummary = {
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
  accounts: AccountSummary[];
};

/** Screen 4. One pass over every account — the SD view is a comparison, not a sum. */
export async function getDepartmentToday(
  reference: Date = now(),
  zone?: Zone,
  /**
   * Narrows the per-account rows to a known set. Used by `/accounts`, where a
   * team member sees the two clients they work on rather than all five — the
   * *department* totals are left alone, because they are the department's and
   * this is not a permission boundary the query invents.
   */
  onlyAccountIds?: string[],
): Promise<DepartmentToday> {
  const { start, end } = dayRange(reference, zone);
  const weekStart = new Date(start.getTime() - 6 * 86_400_000);
  const priorStart = new Date(start.getTime() - 13 * 86_400_000);

  if (onlyAccountIds && onlyAccountIds.length === 0) {
    return {
      headcount: 0,
      due: 0,
      done: 0,
      overdue: 0,
      percent: 0,
      weekPercent: 0,
      priorWeekPercent: 0,
      accounts: [],
    };
  }

  const rows = await db.execute(sql`
    with dued as (
      select k.account_id,
             count(*) filter (where k.due_date >= ${start} and k.due_date < ${end}) as due,
             count(*) filter (where k.due_date >= ${start} and k.due_date < ${end} and k.completed_at is not null) as done,
             count(*) filter (where k.due_date < ${start} and k.completed_at is null) as overdue,
             count(*) filter (where k.due_date >= ${weekStart} and k.due_date < ${end}) as week_due,
             count(*) filter (where k.due_date >= ${weekStart} and k.due_date < ${end}
                              and ${onTimeIn(zone)}) as week_done,
             count(*) filter (where k.due_date >= ${priorStart} and k.due_date < ${weekStart}) as prior_due,
             count(*) filter (where k.due_date >= ${priorStart} and k.due_date < ${weekStart}
                              and ${onTimeIn(zone)}) as prior_done
      from tasks k where ${isLeaf} group by k.account_id
    )
    select t.id, t.name, d.name as director_name,
           (select count(*) from account_members m where m.account_id = t.id) as headcount,
           coalesce(dued.due, 0) as due, coalesce(dued.done, 0) as done,
           coalesce(dued.overdue, 0) as overdue,
           coalesce(dued.week_due, 0) as week_due, coalesce(dued.week_done, 0) as week_done,
           coalesce(dued.prior_due, 0) as prior_due, coalesce(dued.prior_done, 0) as prior_done
    from accounts t
    left join users d on d.id = t.account_director_id
    left join dued on dued.account_id = t.id
    ${onlyAccountIds ? sql`where t.id in (${uuids(onlyAccountIds)})` : sql``}
    order by t.name
  `);

  const raw = rows.rows as Record<string, string>[];

  const accounts: AccountSummary[] = raw.map((r) => ({
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

  /*
   * Counted over the whole department rather than summed from the accounts.
   *
   * The accounts used to add up to it, and stopped once a board could belong to
   * no account: that work joins to no account row and would fall out of the total
   * entirely, so the department's own boards would be invisible in the
   * department's own numbers.
   *
   * Averaging the accounts' percentages would be wrong for a second reason — it
   * weights a 14-person account the same as a 15-person one and produces a
   * number that is nobody's.
   */
  const totalRow = await db.execute(sql`
    select count(*) filter (where k.due_date >= ${start} and k.due_date < ${end}) as due,
           count(*) filter (where k.due_date >= ${start} and k.due_date < ${end}
                            and k.completed_at is not null) as done,
           count(*) filter (where k.due_date < ${start} and k.completed_at is null) as overdue,
           count(*) filter (where k.due_date >= ${weekStart} and k.due_date < ${end}) as week_due,
           count(*) filter (where k.due_date >= ${weekStart} and k.due_date < ${end}
                            and ${onTimeIn(zone)}) as week_done,
           count(*) filter (where k.due_date >= ${priorStart} and k.due_date < ${weekStart}) as prior_due,
           count(*) filter (where k.due_date >= ${priorStart} and k.due_date < ${weekStart}
                            and ${onTimeIn(zone)}) as prior_done
    from tasks k where ${isLeaf}
  `);
  const total = totalRow.rows[0] as Record<string, string>;
  const sum = (key: string) => Number(total[key]);

  const due = sum("due");
  const done = sum("done");

  return {
    headcount,
    due,
    done,
    overdue: sum("overdue"),
    percent: pct(done, due),
    weekPercent: pct(sum("week_done"), sum("week_due")),
    priorWeekPercent: pct(sum("prior_done"), sum("prior_due")),
    accounts,
  };
}
