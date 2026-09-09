import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks, users, type Task, type User } from "@/db/schema";
import {
  canEditTask,
  canViewTask,
  canViewAccountWork,
} from "@/lib/permissions";
import { assigneesOutsideAccount } from "./accounts";
import { getDayView } from "./tasks";
import { getAccountToday } from "./accounts";
import { getDepartmentToday } from "./department";
import { IDS, NOW, addTask, resetDb, seedOrg, viewerFor } from "../../test/fixture";

/** The `Viewer` a page would have been handed — accounts resolved, as in a session. */
const load = viewerFor;

/**
 * A board with no account belongs to the department, and so does its work.
 *
 * The danger the whole way through is that `null` compares equal to `null` and
 * to nothing else: written carelessly, "your account matches the task's account"
 * makes department work visible to the Senior Director alone, silently, since
 * they are the only person without an account.
 */
describe("work with no account", () => {
  let root: Task;

  beforeEach(async () => {
    await resetDb();
    await seedOrg();
    const id = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    await db.execute(sql`update tasks set account_id = null where id = ${id}`);
    root = (await db.query.tasks.findFirst({ where: eq(tasks.id, id) }))!;
  });

  it("is readable by everyone, including the other account", async () => {
    for (const id of [IDS.anna, IDS.james, IDS.sarah, IDS.mika, IDS.elena]) {
      expect([id, await canViewTask(await load(id), root)]).toEqual([id, true]);
    }
  });

  it("is editable by everyone, the way an account's own work is", async () => {
    expect(await canEditTask(await load(IDS.mika), root)).toBe(true);
  });

  it("opens its board to everyone", async () => {
    for (const id of [IDS.anna, IDS.mika, IDS.elena]) {
      expect([id, canViewAccountWork(await load(id), null)]).toEqual([id, true]);
    }
  });

  it("puts nobody outside the account, because there is no account", async () => {
    // A department board draws its people from the whole department.
    expect(await assigneesOutsideAccount(null, [IDS.anna, IDS.mika, IDS.elena])).toEqual([]);
    // An account's board still refuses somebody from elsewhere.
    expect(await assigneesOutsideAccount(IDS.volvo, [IDS.mika])).toEqual(["Mika Villanueva"]);
  });

  it("stays out of an account's numbers and inside the department's", async () => {
    /*
     * The reason account rollups need no special case: they compare against a
     * account id, and a null never matches one. The department has no such filter
     * and counts everything, which is what "the department's own work" means.
     */
    const account = await getAccountToday(IDS.volvo, NOW);
    const dept = await getDepartmentToday(NOW);

    expect(account!.due).toBe(0);
    expect(dept.due).toBe(1);
  });

  it("still shows up on the day of whoever is assigned to it", async () => {
    // Not being any account's work does not make it nobody's work.
    const day = await getDayView(IDS.anna, NOW);
    expect(day.due).toBe(1);
    expect(day.today.map((t) => t.id)).toContain(root.id);
  });
});
