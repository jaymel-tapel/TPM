import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks, users, type User } from "@/db/schema";
import { canEditTask, canViewTask, canViewTeam, canViewTeamWork } from "./permissions";
import { listBoardsForUser } from "@/queries/tasks";
import { IDS, addTask, resetDb, seedOrg } from "../../test/fixture";

const load = async (id: string): Promise<User> => {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw new Error(`no such user ${id}`);
  return user;
};

beforeAll(async () => {
  await resetDb();
  await seedOrg();
});

/**
 * The rail lists a team's boards and the board page guards them. They are two
 * different functions, so nothing but a test stops them disagreeing — and when
 * they did, the rail advertised a board, marked it as where you were, and the
 * page answered 404.
 */
describe("the rail and the board page agree", () => {
  for (const [who, id] of [
    ["a team member", IDS.anna],
    ["an account director", IDS.sarah],
    ["the senior director", IDS.elena],
  ] as const) {
    it(`offers ${who} only boards the page will open`, async () => {
      const viewer = await load(id);
      const offered = await listBoardsForUser(viewer);
      expect(offered.length).toBeGreaterThan(0);

      for (const board of offered) {
        expect(
          canViewTeamWork(viewer, board.teamId),
          `${viewer.name} was offered "${board.name}" but the page refuses it`,
        ).toBe(true);
      }
    });
  }
});

describe("reaching a team's work", () => {
  it("lets a member reach their own team's", async () => {
    expect(canViewTeamWork(await load(IDS.anna), IDS.teamA)).toBe(true);
  });

  it("still refuses them another team's", async () => {
    expect(canViewTeamWork(await load(IDS.anna), IDS.teamB)).toBe(false);
  });

  it("refuses someone on no team at all", async () => {
    // The senior director is teamless and gets in on rank, so the guard has to
    // be sure it is not simply matching null against null.
    const loose = { ...(await load(IDS.anna)), teamId: null };
    expect(canViewTeamWork(loose, IDS.teamA)).toBe(false);
  });
});

describe("managing a team is a narrower question", () => {
  it("keeps the Team Today rollup to the people who manage", async () => {
    // A member belongs to Team A without being able to manage it. If this ever
    // flips, it is a product decision, not a bug fix.
    expect(canViewTeam(await load(IDS.anna), IDS.teamA)).toBe(false);
    expect(canViewTeam(await load(IDS.sarah), IDS.teamA)).toBe(true);
    expect(canViewTeam(await load(IDS.elena), IDS.teamA)).toBe(true);
  });
});

describe("reading a task and changing one are the same permission", () => {
  it("lets a teammate edit work they can see", async () => {
    // Anna is on Team A, and neither wrote this nor is assigned to it. She
    // used to get a read-only panel and no way to fix a date in front of her.
    const anna = await load(IDS.anna);
    const taskId = await addTask({
      team: IDS.teamA,
      assignees: [IDS.james],
      dueDay: 0,
    });
    const task = (await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) }))!;

    expect(await canViewTask(anna, task)).toBe(true);
    expect(await canEditTask(anna, task)).toBe(true);
  });

  it("still refuses another team's work", async () => {
    const anna = await load(IDS.anna);
    const taskId = await addTask({ team: IDS.teamB, assignees: [IDS.mika], dueDay: 0 });
    const task = (await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) }))!;

    expect(await canViewTask(anna, task)).toBe(false);
    expect(await canEditTask(anna, task)).toBe(false);
  });

  it("keeps an assignee on another team's board", async () => {
    // Assignment reaches across a board even when the team does not.
    const mika = await load(IDS.mika);
    const taskId = await addTask({ team: IDS.teamA, assignees: [IDS.mika], dueDay: 0 });
    const task = (await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) }))!;

    expect(await canEditTask(mika, task)).toBe(true);
  });
});
