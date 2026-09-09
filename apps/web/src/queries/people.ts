import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dayRange, now, pct, type Zone } from "@/lib/date";
import { dayKey } from "@/lib/leave";
import { awayOn, type AwayMark } from "./leave";
import { isLeaf, uuids } from "./sql";
import type { Role } from "@/db/schema";
import type { Viewer } from "@/lib/auth";

export type PersonRollup = {
  id: string;
  name: string;
  role: Role;
  /** Their craft. Null until somebody fills it in. */
  title: string | null;
  /** Every account they work on, by name. */
  accounts: string[];
  due: number;
  done: number;
  overdue: number;
  remaining: number;
  percent: number;
  away: AwayMark | null;
};

/**
 * Who is doing what, across the agency.
 *
 * The one screen that reads people rather than clients — so somebody on Volvo
 * and MG appears once, with both named under them, rather than twice.
 * Their numbers are their whole day's, not one account's slice of it: this
 * answers "how is Anna", and Anna does not experience her day one client at a
 * time.
 *
 * Scoped to people the reader shares an account with, because the roster is
 * already the account's own business and this is the same fact read the other
 * way round. The Senior Director sees everyone.
 */
export async function listPeople(
  viewer: Viewer,
  reference: Date = now(),
  zone?: Zone,
): Promise<PersonRollup[]> {
  const { start, end } = dayRange(reference, zone);
  const senior = viewer.role === "senior_director";
  if (!senior && viewer.accountIds.length === 0) return [];

  /*
   * The roster and who is off, together. Leave never touches `tasks` — that is
   * the invariant the feature was built on — so the two have nothing to say to
   * each other and no reason to queue.
   */
  const [rows, away] = await Promise.all([
    db.execute(sql`
    select u.id, u.name, u.role, u.title,
           coalesce(
             (select json_agg(a.name order by a.name)
              from account_members m join accounts a on a.id = m.account_id
              where m.user_id = u.id),
             '[]'::json
           ) as accounts,
           count(k.id) filter (where k.due_date >= ${start} and k.due_date < ${end}) as due,
           count(k.id) filter (
             where k.due_date >= ${start} and k.due_date < ${end} and k.completed_at is not null
           ) as done,
           count(k.id) filter (where k.due_date < ${start} and k.completed_at is null) as overdue
    from users u
    left join task_assignees ta on ta.user_id = u.id
    left join tasks k on k.id = ta.task_id and ${isLeaf}
    ${
      senior
        ? sql``
        : sql`where exists (
            select 1 from account_members m
            where m.user_id = u.id and m.account_id in (${uuids(viewer.accountIds)})
          )`
    }
    group by u.id, u.name, u.role, u.title
    order by u.name
  `),

    // Null rather than an empty list for the Senior Director: they read every
    // roster, and an empty list means "nobody" everywhere else it is used.
    awayOn(senior ? null : viewer.accountIds, dayKey(reference, zone)),
  ]);

  const raw = rows.rows as Record<string, unknown>[];

  return raw.map((r) => {
    const due = Number(r.due);
    const done = Number(r.done);
    return {
      id: String(r.id),
      name: String(r.name),
      role: r.role as Role,
      title: (r.title as string | null) ?? null,
      accounts: (r.accounts as string[]) ?? [],
      due,
      done,
      overdue: Number(r.overdue),
      remaining: due - done,
      percent: pct(done, due),
      away: away.get(String(r.id)) ?? null,
    };
  });
}
