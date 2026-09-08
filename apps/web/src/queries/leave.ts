import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import type {
  LeaveHalf,
  LeaveKind,
  LeaveStatus,
  Role,
  User,
} from "@/db/schema";
import { isSenior } from "@/lib/permissions";
import type { Viewer } from "@/lib/auth";
import { uuids, worksOn, worksOnAny } from "./sql";

/**
 * One request, as every screen needs it.
 *
 * `startDate` and `endDate` stay strings all the way out. `db.execute` hands
 * back what Postgres printed, which for a `date` column is `yyyy-MM-dd` — and
 * here that is the answer rather than the trap `queries/schedule.ts` warns
 * about, because a leave day is a day and never an instant. The timestamps
 * beside them are instants, so those do get re-made into Dates.
 */
export type LeaveRow = {
  id: string;
  userId: string;
  userName: string;
  role: Role;
  kind: LeaveKind;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  half: LeaveHalf | null;
  note: string | null;
  decidedByName: string | null;
  decidedAt: Date | null;
  createdAt: Date;
};

/**
 * How much of a day somebody is away for, why, and when they are back.
 *
 * `endDate` is carried so a roster can say "Away until Friday" without a
 * second query per person — the difference between a note that tells you
 * something and one that only tells you today.
 */
export type AwayMark = {
  away: "full" | "am" | "pm";
  kind: LeaveKind;
  endDate: string;
};

type RawRow = Omit<LeaveRow, "decidedAt" | "createdAt"> & {
  decidedAt: string | null;
  createdAt: string;
};

/**
 * Whose note this reader is allowed to read.
 *
 * The one genuine privacy expansion in this feature: before it, a team member
 * saw no roster at all, and after it they see their colleagues' names and
 * dates. The dates are the point. The note is not — "a hospital appointment"
 * is nobody's business but the filer's and the person deciding it.
 *
 * Withheld in the SQL rather than in a component, because `@meridian/ui`
 * renders what it is handed and a prop can be passed again somewhere else. The
 * column simply does not leave the database for a reader who has no claim on
 * it.
 */
function readableNote(viewer: Viewer): SQL {
  if (isSenior(viewer)) return sql`l.note`;
  /*
   * A director reads the note of anybody on an account they direct — which is
   * exactly the set they may decide for, and the note exists to be weighed
   * when deciding. `directedIds`, not `accountIds`: working alongside somebody
   * on Nike is not a reason to learn why they are off.
   */
  if (viewer.role === "account_director" && viewer.directedIds.length > 0) {
    return sql`case when l.user_id = ${viewer.id}::uuid or ${worksOnAny(viewer.directedIds)}
                    then l.note else null end`;
  }
  return sql`case when l.user_id = ${viewer.id}::uuid then l.note else null end`;
}

const selectFor = (viewer: Viewer) => sql`
  select l.id,
         l.user_id as "userId",
         u.name as "userName",
         u.role,
         l.kind,
         l.status,
         l.start_date as "startDate",
         l.end_date as "endDate",
         l.half,
         ${readableNote(viewer)} as "note",
         d.name as "decidedByName",
         l.decided_at as "decidedAt",
         l.created_at as "createdAt"
  from leave_requests l
  join users u on u.id = l.user_id
  left join users d on d.id = l.decided_by
`;

function rows(raw: unknown[]): LeaveRow[] {
  return (raw as RawRow[]).map((r) => ({
    ...r,
    decidedAt: r.decidedAt ? new Date(r.decidedAt) : null,
    createdAt: new Date(r.createdAt),
  }));
}


/**
 * Approved leave on one account that touches the window `[from, to]`.
 *
 * Only approved: a pending request is a plan, and a roster that showed it
 * would be telling everybody somebody is away before the person who decides
 * that has agreed.
 */
export async function listAccountLeave(
  viewer: Viewer,
  accountId: string,
  from: string,
  to: string,
): Promise<LeaveRow[]> {
  const result = await db.execute(sql`
    ${selectFor(viewer)}
    where ${worksOn(accountId)}
      and l.status = 'approved'
      and l.start_date <= ${to}::date
      and l.end_date >= ${from}::date
    order by l.start_date, u.name
  `);
  return rows(result.rows);
}

/**
 * Who is away on one day, keyed by person — what a roster reads.
 *
 * `day` is a `yyyy-MM-dd` the caller has already resolved on the *reader's*
 * calendar, the same way `onTimeIn` takes the reader's zone. Two people in
 * different zones can honestly disagree about whether a colleague is off
 * today, and the day boundary belongs to whoever is asking.
 */
export async function awayOn(
  accountIds: string[],
  day: string,
): Promise<Map<string, AwayMark>> {
  if (accountIds.length === 0) return new Map();

  const result = await db.execute(sql`
    select l.user_id as "userId", l.kind, l.half, l.end_date as "endDate"
    from leave_requests l
    join users u on u.id = l.user_id
    where ${worksOnAny(accountIds)}
      and l.status = 'approved'
      and l.start_date <= ${day}::date
      and l.end_date >= ${day}::date
  `);

  const away = new Map<string, AwayMark>();
  const raw = result.rows as {
    userId: string;
    kind: LeaveKind;
    half: LeaveHalf | null;
    endDate: string;
  }[];
  for (const r of raw) {
    // A whole day wins over a half day if a person somehow holds both, because
    // the more absent of the two is the honest thing to show.
    const mark: AwayMark = { away: r.half ?? "full", kind: r.kind, endDate: r.endDate };
    const held = away.get(r.userId);
    if (!held || held.away !== "full") away.set(r.userId, mark);
  }
  return away;
}

/** One person's own requests, newest first. Every status: this is their record. */
export async function listMyLeave(viewer: Viewer): Promise<LeaveRow[]> {
  const result = await db.execute(sql`
    ${selectFor(viewer)}
    where l.user_id = ${viewer.id}::uuid
    order by l.start_date desc
  `);
  return rows(result.rows);
}

/**
 * What this viewer still has to decide.
 *
 * Takes the whole viewer rather than an account id because the Senior Director's
 * queue is not account-shaped: it is every Account Director's request, from both
 * accounts, and nobody else's.
 */
export async function listPendingFor(viewer: Viewer): Promise<LeaveRow[]> {
  if (isSenior(viewer)) {
    const result = await db.execute(sql`
      ${selectFor(viewer)}
      where l.status = 'pending' and u.role = 'account_director'
      order by l.start_date, u.name
    `);
    return rows(result.rows);
  }

  if (viewer.role !== "account_director" || viewer.directedIds.length === 0) return [];

  /*
   * Everyone on an account this director runs — which may include somebody who
   * also works for another director. Both of them see the request and either
   * may settle it; the first decision wins, and `decided_by` records who.
   */
  const result = await db.execute(sql`
    ${selectFor(viewer)}
    where l.status = 'pending'
      and u.role = 'team_member'
      and ${worksOnAny(viewer.directedIds)}
    order by l.start_date, u.name
  `);
  return rows(result.rows);
}

/**
 * This person's live requests that would collide with a new one.
 *
 * Live means pending or approved — a declined or cancelled request is not
 * holding the day. Checked here rather than by a constraint because the answer
 * has to become a sentence somebody can read, and because a range exclusion
 * would need `btree_gist` for a rule this short.
 */
export async function overlappingLeave(
  viewer: Viewer,
  from: string,
  to: string,
): Promise<LeaveRow[]> {
  const result = await db.execute(sql`
    ${selectFor(viewer)}
    where l.user_id = ${viewer.id}::uuid
      and l.status in ('pending', 'approved')
      and l.start_date <= ${to}::date
      and l.end_date >= ${from}::date
    order by l.start_date
  `);
  return rows(result.rows);
}
