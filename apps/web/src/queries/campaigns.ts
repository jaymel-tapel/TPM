import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dayRange, now, pct, type Zone } from "@/lib/date";
import { dayKey } from "@/lib/leave";
import { isBlocked, isLeaf, overdueSql } from "./sql";
import type { CampaignStatus } from "@/db/schema";

export type CampaignRollup = {
  id: string;
  accountId: string;
  name: string;
  status: CampaignStatus;
  startsOn: string;
  endsOn: string;
  /** Every task filed under it, ever — a campaign is a body of work, not a day. */
  total: number;
  done: number;
  overdue: number;
  blocked: number;
  /** Due in the next seven days and not finished. */
  dueSoon: number;
  percent: number;
  /**
   * How far through its own dates it is, 0–100. Read against `percent`: a
   * campaign 80% elapsed and 40% delivered is the thing worth noticing, and
   * neither number says it alone.
   */
  elapsed: number;
};

/**
 * A campaign's delivery, counted the way everything else here is counted.
 *
 * `isLeaf` so splitting a task into three does not inflate the total, and
 * `overdueSql` against today rather than against the campaign's end — a task
 * that slipped last Tuesday is late now, whatever the campaign's dates say.
 *
 * Unlike an account rollup this is not windowed to today. A campaign *is* its
 * window, so counting only today's slice of it would answer a question nobody
 * asked.
 */
export async function listCampaignsForAccount(
  accountId: string,
  reference: Date = now(),
  zone?: Zone,
): Promise<CampaignRollup[]> {
  const { start, end } = dayRange(reference, zone);
  const soon = new Date(end.getTime() + 6 * 86_400_000);
  const today = dayKey(reference, zone);

  const rows = await db.execute(sql`
    select c.id, c.account_id as "accountId", c.name, c.status,
           c.starts_on as "startsOn", c.ends_on as "endsOn",
           count(k.id) as total,
           count(k.id) filter (where k.completed_at is not null) as done,
           count(k.id) filter (where ${overdueSql(start)}) as overdue,
           count(k.id) filter (where ${isBlocked} and k.completed_at is null) as blocked,
           count(k.id) filter (
             where k.completed_at is null and k.due_date >= ${start} and k.due_date < ${soon}
           ) as "dueSoon"
    from campaigns c
    -- Left, and with the task predicates in the join: an inner join would drop
    -- a campaign that has not started, which is exactly the one a director
    -- opens this page to check on.
    left join tasks k on k.campaign_id = c.id and ${isLeaf}
    left join board_statuses s on s.id = k.status_id
    where c.account_id = ${accountId}::uuid
    group by c.id, c.account_id, c.name, c.status, c.starts_on, c.ends_on
    order by c.starts_on desc
  `);

  return (rows.rows as Record<string, string>[]).map((r) => {
    const total = Number(r.total);
    const done = Number(r.done);
    return {
      id: r.id,
      accountId: r.accountId,
      name: r.name,
      status: r.status as CampaignStatus,
      startsOn: r.startsOn,
      endsOn: r.endsOn,
      total,
      done,
      overdue: Number(r.overdue),
      blocked: Number(r.blocked),
      dueSoon: Number(r.dueSoon),
      /*
       * `pct` answers 100 for nothing-out-of-nothing, which is the right answer
       * for a day with no work due and the wrong one for a campaign that has
       * not started. "Winter Drop · Planned · 100%" is a lie the row would tell
       * every time; the component shows a dash instead.
       */
      percent: total === 0 ? 0 : pct(done, total),
      elapsed: elapsedPercent(r.startsOn, r.endsOn, today),
    };
  });
}

/** Whole days, so a campaign's progress does not move at lunchtime. */
function elapsedPercent(startsOn: string, endsOn: string, today: string): number {
  if (today < startsOn) return 0;
  if (today >= endsOn) return 100;
  const day = (value: string) => Date.parse(`${value}T00:00:00Z`);
  const span = day(endsOn) - day(startsOn);
  if (span <= 0) return 100;
  return Math.round(((day(today) - day(startsOn)) / span) * 100);
}

/** The campaigns a task may be filed under: this account's, newest first. */
export async function listCampaignOptions(
  accountId: string,
): Promise<{ id: string; name: string }[]> {
  const rows = await db.execute(sql`
    select id, name from campaigns
    where account_id = ${accountId}::uuid
    order by starts_on desc
  `);
  return rows.rows as unknown as { id: string; name: string }[];
}
