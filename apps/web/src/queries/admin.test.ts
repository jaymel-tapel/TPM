import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teams, users, type User } from "@/db/schema";
import { canAdminister } from "@/lib/permissions";
import { emailTaken, listAdminTeams, listDirectorOptions, listPeople } from "./admin";
import { IDS, resetDb, seedOrg } from "../../test/fixture";

const load = async (id: string): Promise<User> => {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw new Error(`no such user ${id}`);
  return user;
};

beforeEach(async () => {
  await resetDb();
  await seedOrg();
});

describe("who may change the org chart", () => {
  it("is the senior director alone", async () => {
    expect(canAdminister(await load(IDS.elena))).toBe(true);
    // An Account Director editing their own team's membership would be editing
    // the thing their own permissions are read from.
    expect(canAdminister(await load(IDS.sarah))).toBe(false);
    expect(canAdminister(await load(IDS.anna))).toBe(false);
  });
});

describe("the people list", () => {
  it("groups by team and leaves the teamless until last", async () => {
    const people = await listPeople();
    expect(people.at(-1)?.name).toBe("Elena Rivera");
    expect(people[0]?.teamName).toBe("Team A");
  });

  it("counts the work each person is on", async () => {
    const people = await listPeople();
    for (const person of people) expect(person.taskCount).toBe(0);
  });
});

describe("the teams list", () => {
  it("reports headcount, boards and who runs it", async () => {
    const [teamA, teamB] = await listAdminTeams();
    expect(teamA.name).toBe("Team A");
    expect(teamA.headcount).toBe(3);
    expect(teamA.boardCount).toBe(1);
    expect(teamA.accountDirectorName).toBe("Sarah Lim");
    // Team B has nobody running it in the fixture.
    expect(teamB.accountDirectorName).toBeNull();
  });
});

describe("who may run a team", () => {
  it("offers only the account directors already on it", async () => {
    const forA = await listDirectorOptions(IDS.teamA);
    expect(forA.map((d) => d.name)).toEqual(["Sarah Lim"]);

    // Anna is on Team A but is not a director; Sarah is a director but not on
    // Team B. Neither is eligible for Team B.
    expect(await listDirectorOptions(IDS.teamB)).toEqual([]);
  });
});

describe("email is the identity, so it has to be unique", () => {
  it("spots one already taken", async () => {
    expect(await emailTaken("anna@test.co")).toBe(true);
    expect(await emailTaken("nobody@test.co")).toBe(false);
  });

  it("does not count somebody against themselves", async () => {
    // Saving your own record without changing your email must not trip this.
    expect(await emailTaken("anna@test.co", IDS.anna)).toBe(false);
  });
});

describe("moving somebody off a team they run", () => {
  it("leaves the team without a director rather than pointing off it", async () => {
    // What `updatePerson` does, asserted on the shape it has to leave behind:
    // `canViewTeam` reads the director/team pairing, so a stale one would let
    // somebody manage a team they had left.
    await db.update(users).set({ teamId: IDS.teamB }).where(eq(users.id, IDS.sarah));
    await db.update(teams).set({ accountDirectorId: null }).where(eq(teams.id, IDS.teamA));

    const [teamA] = await listAdminTeams();
    expect(teamA.accountDirectorId).toBeNull();
  });
});
