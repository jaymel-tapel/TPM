import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { canViewTeam, canViewTeamWork } from "./permissions";
import { listBoardsForUser } from "@/queries/tasks";
import { IDS, resetDb, seedOrg } from "../../test/fixture";

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
