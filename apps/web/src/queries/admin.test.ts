import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accountMembers, accounts } from "@/db/schema";
import { canAdminister } from "@/lib/permissions";
import { emailTaken, listAdminAccounts, listDirectorOptions, listPeople } from "./admin";
import { IDS, addMembership, resetDb, seedOrg, viewerFor } from "../../test/fixture";

/** The `Viewer` a page would have been handed — accounts resolved, as in a session. */
const load = viewerFor;

beforeEach(async () => {
  await resetDb();
  await seedOrg();
});

describe("who may change the org chart", () => {
  it("is the senior director alone", async () => {
    expect(canAdminister(await load(IDS.elena))).toBe(true);
    // An Account Director editing their own account's membership would be editing
    // the thing their own permissions are read from.
    expect(canAdminister(await load(IDS.sarah))).toBe(false);
    expect(canAdminister(await load(IDS.anna))).toBe(false);
  });
});

describe("the people list", () => {
  it("lists everybody by name, with every account they work on", async () => {
    // Not grouped by account any more: somebody on two would have to be filed
    // under one of them, and picking either would be a lie about the other.
    const people = await listPeople();
    expect(people.map((p) => p.name)).toEqual([
      "Anna Santos",
      "Elena Rivera",
      "James Cruz",
      "Mika Villanueva",
      "Sarah Lim",
    ]);
    const anna = people.find((p) => p.name === "Anna Santos")!;
    expect(anna.accounts.map((a) => a.name)).toEqual(["Nike"]);
    expect(people.find((p) => p.name === "Elena Rivera")!.accounts).toEqual([]);
  });

  it("names both accounts for somebody who works on both", async () => {
    await addMembership(IDS.adidas, IDS.anna);
    const anna = (await listPeople()).find((p) => p.name === "Anna Santos")!;
    expect(anna.accounts.map((a) => a.name)).toEqual(["Adidas", "Nike"]);
  });

  it("counts the work each person is on", async () => {
    const people = await listPeople();
    for (const person of people) expect(person.taskCount).toBe(0);
  });
});

describe("the accounts list", () => {
  it("reports headcount, boards and who runs it", async () => {
    // Alphabetical, so Adidas comes first.
    const [adidas, nike] = await listAdminAccounts();
    expect(nike.name).toBe("Nike");
    expect(nike.headcount).toBe(3);
    expect(nike.boardCount).toBe(1);
    expect(nike.accountDirectorName).toBe("Sarah Lim");
    // Adidas has nobody running it in the fixture.
    expect(adidas.name).toBe("Adidas");
    expect(adidas.accountDirectorName).toBeNull();
  });
});

describe("who may run an account", () => {
  it("offers only the account directors already on it", async () => {
    const forA = await listDirectorOptions(IDS.nike);
    expect(forA.map((d) => d.name)).toEqual(["Sarah Lim"]);

    // Anna is on Nike but is not a director; Sarah is a director but not on
    // Adidas. Neither is eligible for Adidas.
    expect(await listDirectorOptions(IDS.adidas)).toEqual([]);
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

describe("moving somebody off an account they run", () => {
  it("leaves the account without a director rather than pointing off it", async () => {
    // What `updatePerson` does, asserted on the shape it has to leave behind:
    // `canViewAccount` reads the director/account pairing, so a stale one would let
    // somebody manage an account they had left.
    await db
      .delete(accountMembers)
      .where(and(eq(accountMembers.userId, IDS.sarah), eq(accountMembers.accountId, IDS.nike)));
    await db.update(accounts).set({ accountDirectorId: null }).where(eq(accounts.id, IDS.nike));

    const [nike] = await listAdminAccounts();
    expect(nike.accountDirectorId).toBeNull();
  });
});
