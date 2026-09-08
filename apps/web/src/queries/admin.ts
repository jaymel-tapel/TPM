import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { teams, users, type Role } from "@/db/schema";

/** A person as the admin screens list them. */
export type AdminPerson = {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamId: string | null;
  teamName: string | null;
  /** Work they own. What makes a person impossible to simply remove. */
  taskCount: number;
};

export type AdminTeam = {
  id: string;
  name: string;
  accountDirectorId: string | null;
  accountDirectorName: string | null;
  headcount: number;
  boardCount: number;
};

/**
 * Everyone, in reading order: teams together, and the Senior Director — who is
 * on no team — last rather than floating at the top.
 */
export async function listPeople(): Promise<AdminPerson[]> {
  const rows = await db.execute(sql`
    select u.id, u.name, u.email, u.role,
      u.team_id as "teamId", t.name as "teamName",
      (select count(*) from task_assignees a where a.user_id = u.id)::int as "taskCount"
    from users u
    left join teams t on t.id = u.team_id
    order by (u.team_id is null), t.name, u.name
  `);
  return rows.rows as unknown as AdminPerson[];
}

export async function getPerson(userId: string): Promise<AdminPerson | null> {
  const rows = await db.execute(sql`
    select u.id, u.name, u.email, u.role,
      u.team_id as "teamId", t.name as "teamName",
      (select count(*) from task_assignees a where a.user_id = u.id)::int as "taskCount"
    from users u
    left join teams t on t.id = u.team_id
    where u.id = ${userId}::uuid
  `);
  return (rows.rows as unknown as AdminPerson[])[0] ?? null;
}

export async function listAdminTeams(): Promise<AdminTeam[]> {
  const rows = await db.execute(sql`
    select t.id, t.name,
      t.account_director_id as "accountDirectorId", d.name as "accountDirectorName",
      (select count(*) from users u where u.team_id = t.id)::int as headcount,
      (select count(*) from boards b where b.team_id = t.id)::int as "boardCount"
    from teams t
    left join users d on d.id = t.account_director_id
    order by t.name
  `);
  return rows.rows as unknown as AdminTeam[];
}

export async function getAdminTeam(teamId: string): Promise<AdminTeam | null> {
  const all = await listAdminTeams();
  return all.find((t) => t.id === teamId) ?? null;
}

/** Who may be made a team's Account Director: the directors already on it. */
export async function listDirectorOptions(teamId: string) {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(sql`${users.teamId} = ${teamId}::uuid and ${users.role} = 'account_director'`)
    .orderBy(asc(users.name));
}

export async function listTeamOptions() {
  return db.select({ id: teams.id, name: teams.name }).from(teams).orderBy(asc(teams.name));
}

/** Whether an email is already taken by somebody else. */
export async function emailTaken(email: string, exceptUserId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  return Boolean(row) && row.id !== exceptUserId;
}
