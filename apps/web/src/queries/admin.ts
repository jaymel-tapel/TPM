import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, users, type Role } from "@/db/schema";

/** A person as the admin screens list them. */
export type AdminPerson = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** What they do — "Designer", "Copywriter". Null until somebody fills it in. */
  title: string | null;
  /** Every account they work on. Several, now, and often none for the Senior Director. */
  accounts: { id: string; name: string }[];
  /** Work they own. What makes a person impossible to simply remove. */
  taskCount: number;
};

export type AdminAccount = {
  id: string;
  name: string;
  accountDirectorId: string | null;
  accountDirectorName: string | null;
  headcount: number;
  boardCount: number;
};

/**
 * Every account a person works on, as a JSON array on their row.
 *
 * Grouping in SQL rather than joining and stitching in TypeScript: a person on
 * three accounts would otherwise be three rows, and every caller would have to
 * remember to fold them back together.
 */
const accountsOf = sql`
  coalesce(
    (select json_agg(json_build_object('id', a.id, 'name', a.name) order by a.name)
     from account_members m join accounts a on a.id = m.account_id
     where m.user_id = u.id),
    '[]'::json
  ) as accounts`;

/** Everyone, by name. Nobody has one account to sort by any more. */
export async function listPeople(): Promise<AdminPerson[]> {
  const rows = await db.execute(sql`
    select u.id, u.name, u.email, u.role, u.title,
      ${accountsOf},
      (select count(*) from task_assignees a where a.user_id = u.id)::int as "taskCount"
    from users u
    order by u.name
  `);
  return rows.rows as unknown as AdminPerson[];
}

export async function getPerson(userId: string): Promise<AdminPerson | null> {
  const rows = await db.execute(sql`
    select u.id, u.name, u.email, u.role, u.title,
      ${accountsOf},
      (select count(*) from task_assignees a where a.user_id = u.id)::int as "taskCount"
    from users u
    where u.id = ${userId}::uuid
  `);
  return (rows.rows as unknown as AdminPerson[])[0] ?? null;
}

export async function listAdminAccounts(): Promise<AdminAccount[]> {
  const rows = await db.execute(sql`
    select t.id, t.name,
      t.account_director_id as "accountDirectorId", d.name as "accountDirectorName",
      (select count(*) from account_members m where m.account_id = t.id)::int as headcount,
      (select count(*) from boards b where b.account_id = t.id)::int as "boardCount"
    from accounts t
    left join users d on d.id = t.account_director_id
    order by t.name
  `);
  return rows.rows as unknown as AdminAccount[];
}

export async function getAdminAccount(accountId: string): Promise<AdminAccount | null> {
  const all = await listAdminAccounts();
  return all.find((t) => t.id === accountId) ?? null;
}

/**
 * Who may be made an account's Account Director: the directors working on it.
 *
 * Still membership-first, the way it was when membership was a column — a
 * director has to be on the account before they can run it, so the pairing
 * `canViewAccount` reads can never point at somebody who left.
 */
export async function listDirectorOptions(accountId: string) {
  const rows = await db.execute(sql`
    select u.id, u.name
    from users u
    join account_members m on m.user_id = u.id
    where m.account_id = ${accountId}::uuid and u.role = 'account_director'
    order by u.name
  `);
  return rows.rows as unknown as { id: string; name: string }[];
}

export async function listAccountOptions() {
  return db.select({ id: accounts.id, name: accounts.name }).from(accounts).orderBy(asc(accounts.name));
}

/** Whether an email is already taken by somebody else. */
export async function emailTaken(email: string, exceptUserId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  return Boolean(row) && row.id !== exceptUserId;
}
