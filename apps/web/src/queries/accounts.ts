import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dayRange, now, pct, type Zone } from "@/lib/date";
import { isBlocked, isLeaf, uuids } from "./sql";
import { dayKey } from "@/lib/leave";
import { awayOn, type AwayMark } from "./leave";
import type { Role } from "@/db/schema";
import type { Viewer } from "@/lib/auth";

export type MemberRollup = {
  id: string;
  name: string;
  role: Role;
  /** Their craft — "Designer", "Copywriter". Null until somebody fills it in. */
  title: string | null;
  due: number;
  done: number;
  overdue: number;
  /** Due today and not done yet. */
  remaining: number;
  percent: number;
  /**
   * Whether they are off today. Null when they are in.
   *
   * Filled here rather than left to each page, because every caller of
   * `getAccountToday` renders a `MemberRow` and one of them would eventually
   * forget. It is a third query, not a join — the completion SQL above is what
   * reporting depends on and nothing about leave belongs inside it.
   */
  away: AwayMark | null;
};

export type AccountToday = {
  accountId: string;
  accountName: string;
  directorName: string | null;
  headcount: number;
  due: number;
  done: number;
  overdue: number;
  /**
   * Open work sitting in a column somebody typed as blocked. Counted off
   * `board_statuses.kind` rather than a column name, because the names are
   * whoever made the board's and only the kind is shared vocabulary.
   */
  blocked: number;
  percent: number;
  members: MemberRollup[];
};

/**
 * Screen 3. Per-person rollups come through task_assignees (so a shared task
 * counts for each person), while the account totals use tasks.account_id (so it
 * counts once for the account).
 *
 * `days` widens the window backwards from today — 1 is today, 7 is the last
 * seven whole days. Only *due and done* move with it. **Overdue stays anchored
 * to today**, because overdue means carried over from an earlier day, and
 * letting the window define it would quietly forgive everything inside the
 * window: a task due Monday and still unfinished on Friday would stop counting
 * the moment somebody switched to the week.
 */
export async function getAccountToday(
  accountId: string,
  reference: Date = now(),
  zone?: Zone,
  days = 1,
): Promise<AccountToday | null> {
  const { start, end } = dayRange(reference, zone);
  // Whole days ending today, today included.
  const from = new Date(start.getTime() - (days - 1) * 86_400_000);

  /*
   * The account's totals, who is away, and the roster — one trip, not three.
   * All three are keyed on the same account id and none reads another's
   * result; a missing account is checked after, because the other two return
   * nothing for an id that is not there.
   */
  const [accountRows, away, memberRows] = await Promise.all([
    db.execute(sql`
    select t.id, t.name, d.name as director_name,
           (select count(*) from account_members m where m.account_id = t.id) as headcount,
           (select count(*) from tasks k where k.account_id = t.id and ${isLeaf} and k.due_date >= ${from} and k.due_date < ${end}) as due,
           (select count(*) from tasks k where k.account_id = t.id and ${isLeaf} and k.due_date >= ${from} and k.due_date < ${end} and k.completed_at is not null) as done,
           (select count(*) from tasks k where k.account_id = t.id and ${isLeaf} and k.due_date < ${start} and k.completed_at is null) as overdue,
           (select count(*) from tasks k
              join board_statuses s on s.id = k.status_id
              where k.account_id = t.id and ${isLeaf} and ${isBlocked} and k.completed_at is null) as blocked
    from accounts t
    left join users d on d.id = t.account_director_id
    where t.id = ${accountId}
  `),

    awayOn([accountId], dayKey(reference, zone)),

    db.execute(sql`
      select u.id, u.name, u.role, u.title,
             count(k.id) filter (where k.due_date >= ${from} and k.due_date < ${end}) as due,
             count(k.id) filter (where k.due_date >= ${from} and k.due_date < ${end} and k.completed_at is not null) as done,
             count(k.id) filter (where k.due_date < ${start} and k.completed_at is null) as overdue
      from users u
      left join task_assignees a on a.user_id = u.id
      left join tasks k on k.id = a.task_id and ${isLeaf}
      join account_members m on m.user_id = u.id and m.account_id = ${accountId}
      group by u.id, u.name, u.role, u.title
      order by (u.role = 'account_director') desc, u.name
    `),
  ]);

  const account = accountRows.rows[0] as
    | {
        id: string;
        name: string;
        director_name: string | null;
        headcount: string;
        due: string;
        done: string;
        overdue: string;
        blocked: string;
      }
    | undefined;
  if (!account) return null;

  const members: MemberRollup[] = (memberRows.rows as Record<string, string>[]).map((r) => {
    const due = Number(r.due);
    const done = Number(r.done);
    return {
      id: r.id,
      name: r.name,
      role: r.role as Role,
      title: r.title,
      due,
      done,
      overdue: Number(r.overdue),
      remaining: due - done,
      percent: pct(done, due),
      away: away.get(r.id) ?? null,
    };
  });

  const due = Number(account.due);
  const done = Number(account.done);
  return {
    accountId: account.id,
    accountName: account.name,
    directorName: account.director_name,
    headcount: Number(account.headcount),
    due,
    done,
    overdue: Number(account.overdue),
    blocked: Number(account.blocked),
    percent: pct(done, due),
    members,
  };
}

export async function listAccounts(): Promise<{ id: string; name: string }[]> {
  const rows = await db.execute(sql`select id, name from accounts order by name`);
  return rows.rows as unknown as { id: string; name: string }[];
}

/**
 * The accounts the rail may show, busiest first.
 *
 * Ranked here, capped in the rail. The handoff asks for three to five, and the
 * reason is the rail itself: an Account Director on six clients, each
 * expandable, is a navigation column you scroll past to reach Docs. Which five
 * depends on which page you are on, and only the sidebar knows that — so this
 * returns the order and lets the rail take from the top.
 *
 * "Busiest" is the reader's own open work, not the account's. The rail is a
 * personal object, and the client you have four things due on today is the one
 * you want at the top whoever else is busy.
 */
export async function railAccountsFor(
  viewer: Viewer,
): Promise<{ id: string; name: string }[]> {
  const senior = viewer.role === "senior_director";
  if (!senior && viewer.accountIds.length === 0) return [];

  const rows = await db.execute(sql`
    select a.id, a.name,
           count(k.id) filter (
             where k.completed_at is null
               and exists (
                 select 1 from task_assignees ta
                 where ta.task_id = k.id and ta.user_id = ${viewer.id}::uuid
               )
           ) as mine
    from accounts a
    left join tasks k on k.account_id = a.id and ${isLeaf}
    ${senior ? sql`` : sql`where a.id in (${uuids(viewer.accountIds)})`}
    group by a.id, a.name
    order by mine desc, a.name
  `);

  return (rows.rows as unknown as { id: string; name: string }[]).map((a) => ({
    id: a.id,
    name: a.name,
  }));
}

/** One account, for the header every page in its section carries. */
export async function getAccount(
  accountId: string,
): Promise<{ id: string; name: string; directorName: string | null } | null> {
  const rows = await db.execute(sql`
    select a.id, a.name, d.name as "directorName"
    from accounts a
    left join users d on d.id = a.account_director_id
    where a.id = ${accountId}::uuid
  `);
  return (rows.rows[0] as { id: string; name: string; directorName: string | null }) ?? null;
}

/** Names for a known set of account ids, in reading order. */
export async function listAccountsById(ids: string[]): Promise<{ id: string; name: string }[]> {
  if (ids.length === 0) return [];
  const rows = await db.execute(
    sql`select id, name from accounts where id in (${uuids(ids)}) order by name`,
  );
  return rows.rows as unknown as { id: string; name: string }[];
}

export async function listAccountMembers(accountId: string) {
  const rows = await db.execute(
    sql`select u.id, u.name, u.role from users u
        join account_members m on m.user_id = u.id
        where m.account_id = ${accountId}
        order by u.name`,
  );
  return rows.rows as unknown as { id: string; name: string; role: Role }[];
}

/**
 * Who may be put on an account's work.
 *
 * Work belongs to a board, a board belongs to an account, and a task's
 * assignees are the people responsible for it — so they have to be people that
 * account's board actually reaches. Assigning across accounts would put the
 * task in a stranger's My Tasks and count it in their completion rate.
 *
 * One row per person, not one per membership. Somebody on Volvo and MG is
 * one name in the picker with both accounts named beneath it; listing them
 * twice would let you assign the same person to the same task twice over.
 *
 * The Senior Director is on no account and so is on nobody's board: they
 * oversee the work rather than carry it, which is what the inner join to
 * `account_members` has always said here.
 */
export async function listAssignableUsers(accountIds?: string[]) {
  if (accountIds && accountIds.length === 0) return [];

  const rows = await db.execute(
    sql`select u.id, u.name, u.role,
               array_agg(distinct m.account_id) as account_ids,
               string_agg(distinct a.name, ', ') as account_names
        from users u
        join account_members m on m.user_id = u.id
        join accounts a on a.id = m.account_id
        ${accountIds ? sql`where m.account_id in (${sql.join(accountIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``}
        group by u.id, u.name, u.role
        order by u.name`,
  );
  return rows.rows as unknown as {
    id: string;
    name: string;
    role: Role;
    /** Which accounts they work on, so a per-board picker can narrow to one. */
    account_ids: string[];
    /** The same accounts by name, for the line under their name. */
    account_names: string | null;
  }[];
}

/**
 * The assignees among these ids who are not on the given account.
 *
 * The picker only offers the right people, but the ids arrive in a form
 * payload — so the rule is enforced where it counts rather than where it is
 * displayed. Returns names, because "who" is what the message has to say.
 */
export async function assigneesOutsideAccount(
  accountId: string | null,
  userIds: string[],
): Promise<string[]> {
  if (userIds.length === 0) return [];
  /*
   * A board with no account belongs to the department, so anybody in it may be
   * put on the work. There is no account to be outside of.
   */
  if (accountId === null) return [];
  const rows = await db.execute(
    sql`select u.name from users u
        where u.id in (${sql.join(userIds.map((id) => sql`${id}::uuid`), sql`, `)})
          and not exists (
            select 1 from account_members m
            where m.user_id = u.id and m.account_id = ${accountId}::uuid
          )
        order by u.name`,
  );
  return (rows.rows as unknown as { name: string }[]).map((r) => r.name);
}

/**
 * Everybody, for the chat picker.
 *
 * Deliberately not `listAssignableUsers`, which joins `accounts` — so the Senior
 * Director, the one person with no account, does not appear in it at all. Reusing
 * it here would have meant nobody in the department could message their
 * director, and nothing would have said so.
 */
export async function listChatPeople(): Promise<{ id: string; name: string; accountName: string | null }[]> {
  const rows = await db.execute(sql`
    select u.id, u.name,
           string_agg(distinct a.name, ', ' order by a.name) as account_name
    from users u
    left join account_members m on m.user_id = u.id
    left join accounts a on a.id = m.account_id
    group by u.id, u.name
    order by u.name
  `);
  return (rows.rows as unknown as { id: string; name: string; account_name: string | null }[]).map(
    (r) => ({ id: r.id, name: r.name, accountName: r.account_name }),
  );
}
