import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks, users, type Task, type User } from "@/db/schema";
import {
  canEditTask,
  canViewTask,
  canViewTeamWork,
} from "@/lib/permissions";
import { assigneesOutsideTeam } from "./team";
import { getDayView } from "./tasks";
import { getTeamToday } from "./team";
import { getDepartmentToday } from "./department";
import { IDS, NOW, addTask, resetDb, seedOrg } from "../../test/fixture";

const load = async (id: string): Promise<User> => {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw new Error(`no such user ${id}`);
  return user;
};

/**
 * A board with no team belongs to the department, and so does its work.
 *
 * The danger the whole way through is that `null` compares equal to `null` and
 * to nothing else: written carelessly, "your team matches the task's team"
 * makes department work visible to the Senior Director alone, silently, since
 * they are the only person without a team.
 */
describe("work with no team", () => {
  let root: Task;

  beforeEach(async () => {
    await resetDb();
    await seedOrg();
    const id = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0 });
    await db.execute(sql`update tasks set team_id = null where id = ${id}`);
    root = (await db.query.tasks.findFirst({ where: eq(tasks.id, id) }))!;
  });

  it("is readable by everyone, including the other team", async () => {
    for (const id of [IDS.anna, IDS.james, IDS.sarah, IDS.mika, IDS.elena]) {
      expect([id, await canViewTask(await load(id), root)]).toEqual([id, true]);
    }
  });

  it("is editable by everyone, the way a team's own work is", async () => {
    expect(await canEditTask(await load(IDS.mika), root)).toBe(true);
  });

  it("opens its board to everyone", async () => {
    for (const id of [IDS.anna, IDS.mika, IDS.elena]) {
      expect([id, canViewTeamWork(await load(id), null)]).toEqual([id, true]);
    }
  });

  it("puts nobody outside the team, because there is no team", async () => {
    // A department board draws its people from the whole department.
    expect(await assigneesOutsideTeam(null, [IDS.anna, IDS.mika, IDS.elena])).toEqual([]);
    // A team's board still refuses somebody from elsewhere.
    expect(await assigneesOutsideTeam(IDS.teamA, [IDS.mika])).toEqual(["Mika Villanueva"]);
  });

  it("stays out of a team's numbers and inside the department's", async () => {
    /*
     * The reason team rollups need no special case: they compare against a
     * team id, and a null never matches one. The department has no such filter
     * and counts everything, which is what "the department's own work" means.
     */
    const team = await getTeamToday(IDS.teamA, NOW);
    const dept = await getDepartmentToday(NOW);

    expect(team!.due).toBe(0);
    expect(dept.due).toBe(1);
  });

  it("still shows up on the day of whoever is assigned to it", async () => {
    // Not being any team's work does not make it nobody's work.
    const day = await getDayView(IDS.anna, NOW);
    expect(day.due).toBe(1);
    expect(day.today.map((t) => t.id)).toContain(root.id);
  });
});
