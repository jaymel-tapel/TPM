import { sql } from "drizzle-orm";
import { db } from "@/db";
import { taskAssignees, tasks, teams, users } from "@/db/schema";
import { startOfAppDay } from "@/lib/date";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** 1pm Manila on Monday 7 September 2026. */
export const NOW = new Date("2026-09-07T05:00:00Z");
export const TODAY = startOfAppDay(NOW);

export const IDS = {
  teamA: "11111111-1111-4111-a111-111111111111",
  teamB: "22222222-2222-4222-a222-222222222222",
  anna: "aaaaaaaa-1111-4111-a111-111111111111",
  james: "aaaaaaaa-2222-4222-a222-222222222222",
  sarah: "aaaaaaaa-3333-4333-a333-333333333333",
  mika: "bbbbbbbb-1111-4111-a111-111111111111",
  elena: "cccccccc-1111-4111-a111-111111111111",
};

export async function resetDb() {
  await db.execute(
    sql`truncate task_tags, task_assignees, tasks, tags, users, teams restart identity cascade`,
  );
}

/** Two teams, five people. Small enough that every expected number can be
 *  worked out by hand in the test itself. */
export async function seedOrg() {
  await db.insert(teams).values([
    { id: IDS.teamA, name: "Team A" },
    { id: IDS.teamB, name: "Team B" },
  ]);

  await db.insert(users).values([
    { id: IDS.anna, name: "Anna Santos", email: "anna@test.co", passwordHash: "x", role: "team_member", teamId: IDS.teamA },
    { id: IDS.james, name: "James Cruz", email: "james@test.co", passwordHash: "x", role: "team_member", teamId: IDS.teamA },
    { id: IDS.sarah, name: "Sarah Lim", email: "sarah@test.co", passwordHash: "x", role: "account_director", teamId: IDS.teamA },
    { id: IDS.mika, name: "Mika Villanueva", email: "mika@test.co", passwordHash: "x", role: "team_member", teamId: IDS.teamB },
    { id: IDS.elena, name: "Elena Rivera", email: "elena@test.co", passwordHash: "x", role: "senior_director", teamId: null },
  ]);

  await db.update(teams).set({ accountDirectorId: IDS.sarah }).where(sql`id = ${IDS.teamA}`);
}

let n = 0;

/**
 * `dueDay` is an offset in days from today (0 = today, -1 = yesterday).
 * `completedDay` is the same, or null for still-open. Times are set so a task
 * is due mid-afternoon and completed relative to that.
 */
export async function addTask(opts: {
  team: string;
  assignees: string[];
  dueDay: number;
  dueHour?: number;
  completedDay?: number | null;
  completedHour?: number;
  status?: "todo" | "in_progress" | "done" | "blocked";
  type?: "client_work" | "internal" | "admin" | "review" | "meeting" | "creative";
}) {
  n += 1;
  const id = `dddddddd-${String(n).padStart(4, "0")}-4000-a000-000000000000`;
  const due = new Date(TODAY.getTime() + opts.dueDay * DAY + (opts.dueHour ?? 15) * HOUR);
  const completedAt =
    opts.completedDay === null || opts.completedDay === undefined
      ? null
      : new Date(TODAY.getTime() + opts.completedDay * DAY + (opts.completedHour ?? 14) * HOUR);

  await db.insert(tasks).values({
    id,
    title: `Task ${n}`,
    type: opts.type ?? "client_work",
    status: opts.status ?? (completedAt ? "done" : "todo"),
    priority: "normal",
    dueDate: due,
    completedAt,
    createdBy: opts.assignees[0],
    teamId: opts.team,
    createdAt: new Date(due.getTime() - DAY),
    updatedAt: due,
  });

  await db
    .insert(taskAssignees)
    .values(opts.assignees.map((userId) => ({ taskId: id, userId })));
  return id;
}
