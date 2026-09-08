import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dayRange, now, pct } from "@/lib/date";
import type { Role } from "@/db/schema";

export type MemberRollup = {
  id: string;
  name: string;
  role: Role;
  due: number;
  done: number;
  overdue: number;
  /** Due today and not done yet. */
  remaining: number;
  percent: number;
};

export type TeamToday = {
  teamId: string;
  teamName: string;
  directorName: string | null;
  headcount: number;
  due: number;
  done: number;
  overdue: number;
  percent: number;
  members: MemberRollup[];
};

/**
 * Screen 3. Per-person rollups come through task_assignees (so a shared task
 * counts for each person), while the team totals use tasks.team_id (so it
 * counts once for the team).
 */
export async function getTeamToday(teamId: string, reference: Date = now()): Promise<TeamToday | null> {
  const { start, end } = dayRange(reference);

  const teamRows = await db.execute(sql`
    select t.id, t.name, d.name as director_name,
           (select count(*) from users u where u.team_id = t.id) as headcount,
           (select count(*) from tasks k where k.team_id = t.id and k.due_date >= ${start} and k.due_date < ${end}) as due,
           (select count(*) from tasks k where k.team_id = t.id and k.due_date >= ${start} and k.due_date < ${end} and k.completed_at is not null) as done,
           (select count(*) from tasks k where k.team_id = t.id and k.due_date < ${start} and k.completed_at is null) as overdue
    from teams t
    left join users d on d.id = t.account_director_id
    where t.id = ${teamId}
  `);
  const team = teamRows.rows[0] as
    | { id: string; name: string; director_name: string | null; headcount: string; due: string; done: string; overdue: string }
    | undefined;
  if (!team) return null;

  const memberRows = await db.execute(sql`
    select u.id, u.name, u.role,
           count(k.id) filter (where k.due_date >= ${start} and k.due_date < ${end}) as due,
           count(k.id) filter (where k.due_date >= ${start} and k.due_date < ${end} and k.completed_at is not null) as done,
           count(k.id) filter (where k.due_date < ${start} and k.completed_at is null) as overdue
    from users u
    left join task_assignees a on a.user_id = u.id
    left join tasks k on k.id = a.task_id
    where u.team_id = ${teamId}
    group by u.id, u.name, u.role
    order by (u.role = 'account_director') desc, u.name
  `);

  const members: MemberRollup[] = (memberRows.rows as Record<string, string>[]).map((r) => {
    const due = Number(r.due);
    const done = Number(r.done);
    return {
      id: r.id,
      name: r.name,
      role: r.role as Role,
      due,
      done,
      overdue: Number(r.overdue),
      remaining: due - done,
      percent: pct(done, due),
    };
  });

  const due = Number(team.due);
  const done = Number(team.done);
  return {
    teamId: team.id,
    teamName: team.name,
    directorName: team.director_name,
    headcount: Number(team.headcount),
    due,
    done,
    overdue: Number(team.overdue),
    percent: pct(done, due),
    members,
  };
}

export async function listTeams(): Promise<{ id: string; name: string }[]> {
  const rows = await db.execute(sql`select id, name from teams order by name`);
  return rows.rows as unknown as { id: string; name: string }[];
}

export async function listTeamMembers(teamId: string) {
  const rows = await db.execute(
    sql`select id, name, role from users where team_id = ${teamId} order by name`,
  );
  return rows.rows as unknown as { id: string; name: string; role: Role }[];
}

/**
 * Who may be put on a team's work.
 *
 * Work belongs to a board, a board belongs to a team, and a task's assignees
 * are the people responsible for it — so they have to be people that team's
 * board actually reaches. Assigning across teams would put the task in a
 * stranger's My Tasks and count it in their completion rate.
 *
 * The Senior Director is on no team and so is on nobody's board: they oversee
 * the work rather than carry it, which is what `team_id is not null` has always
 * said here.
 */
export async function listAssignableUsers(teamIds?: string[]) {
  if (teamIds && teamIds.length === 0) return [];

  const rows = await db.execute(
    sql`select u.id, u.name, u.role, u.team_id, t.name as team_name
        from users u join teams t on t.id = u.team_id
        ${teamIds ? sql`where u.team_id in (${sql.join(teamIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``}
        order by t.name, u.name`,
  );
  return rows.rows as unknown as {
    id: string;
    name: string;
    role: Role;
    team_id: string;
    team_name: string | null;
  }[];
}

/**
 * The assignees among these ids who are not on the given team.
 *
 * The picker only offers the right people, but the ids arrive in a form
 * payload — so the rule is enforced where it counts rather than where it is
 * displayed. Returns names, because "who" is what the message has to say.
 */
export async function assigneesOutsideTeam(
  teamId: string,
  userIds: string[],
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await db.execute(
    sql`select u.name from users u
        where u.id in (${sql.join(userIds.map((id) => sql`${id}::uuid`), sql`, `)})
          and (u.team_id is null or u.team_id <> ${teamId}::uuid)
        order by u.name`,
  );
  return (rows.rows as unknown as { name: string }[]).map((r) => r.name);
}
