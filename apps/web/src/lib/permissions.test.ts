import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accountMembers, tasks } from "@/db/schema";
import {
  canDecideLeave,
  canEditTask,
  canViewTask,
  canViewAccount,
  canViewAccountWork,
} from "./permissions";
import { listBoardsForUser } from "@/queries/tasks";
import { IDS, addMembership, addTask, resetDb, seedOrg, viewerFor } from "../../test/fixture";

/**
 * `viewerFor`, not a bare `users` row: every predicate here reads the accounts
 * off the session, so a test that hands it something else is testing a shape
 * the app never constructs.
 */
const load = viewerFor;

/** The accounts somebody works on, for the leave rule that takes them. */
const accountsOf = async (userId: string) =>
  (
    await db
      .select({ accountId: accountMembers.accountId })
      .from(accountMembers)
      .where(eq(accountMembers.userId, userId))
  ).map((row) => row.accountId);

beforeAll(async () => {
  await resetDb();
  await seedOrg();
});

/**
 * The rail lists an account's boards and the board page guards them. They are two
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
          canViewAccountWork(viewer, board.accountId),
          `${viewer.name} was offered "${board.name}" but the page refuses it`,
        ).toBe(true);
      }
    });
  }
});

describe("reaching an account's work", () => {
  it("lets a member reach their own account's", async () => {
    expect(canViewAccountWork(await load(IDS.anna), IDS.nike)).toBe(true);
  });

  it("still refuses them another account's", async () => {
    expect(canViewAccountWork(await load(IDS.anna), IDS.adidas)).toBe(false);
  });

  it("refuses someone on no account at all", async () => {
    // The senior director is accountless and gets in on rank, so the guard has
    // to be sure it is not simply matching an empty list against a null.
    const loose = { ...(await load(IDS.anna)), accountIds: [], directedIds: [] };
    expect(canViewAccountWork(loose, IDS.nike)).toBe(false);
  });

  it("gives department work to everybody, including the accountless", async () => {
    // A board with no account has nothing to scope by. Answered before the
    // membership test, or an empty list would read as a refusal.
    expect(canViewAccountWork(await load(IDS.anna), null)).toBe(true);
    expect(canViewAccountWork(await load(IDS.elena), null)).toBe(true);
  });
});

describe("managing an account is a narrower question", () => {
  it("keeps the Account Today rollup to the people who manage", async () => {
    // A member belongs to Nike without being able to manage it. If this ever
    // flips, it is a product decision, not a bug fix.
    expect(canViewAccount(await load(IDS.anna), IDS.nike)).toBe(false);
    expect(canViewAccount(await load(IDS.sarah), IDS.nike)).toBe(true);
    expect(canViewAccount(await load(IDS.elena), IDS.nike)).toBe(true);
  });
});

describe("who signs off leave", () => {
  it("gives a team member's request to a director of an account they work on", async () => {
    const [sarah, anna] = [await load(IDS.sarah), await load(IDS.anna)];
    expect(canDecideLeave(sarah, anna, await accountsOf(IDS.anna))).toBe(true);
  });

  it("keeps it away from a director of an account they do not work on", async () => {
    const [sarah, mika] = [await load(IDS.sarah), await load(IDS.mika)];
    expect(canDecideLeave(sarah, mika, await accountsOf(IDS.mika))).toBe(false);
  });

  it("gives an Account Director's own request to the Senior Director", async () => {
    // Nothing anywhere names this as a special case. The chart runs out above
    // Sarah, and the only rule that has to be added is the next one.
    const [elena, sarah] = [await load(IDS.elena), await load(IDS.sarah)];
    expect(canDecideLeave(elena, sarah, await accountsOf(IDS.sarah))).toBe(true);
  });

  it("lets nobody sign off their own, at any level", async () => {
    const [sarah, elena, anna] = [
      await load(IDS.sarah),
      await load(IDS.elena),
      await load(IDS.anna),
    ];
    // An approval nobody else makes is not an approval; it is a status field
    // with extra steps.
    expect(canDecideLeave(sarah, sarah, await accountsOf(IDS.sarah))).toBe(false);
    expect(canDecideLeave(elena, elena, await accountsOf(IDS.elena))).toBe(false);
    expect(canDecideLeave(anna, anna, await accountsOf(IDS.anna))).toBe(false);
  });

  it("lets no team member decide anything", async () => {
    const [anna, james] = [await load(IDS.anna), await load(IDS.james)];
    expect(canDecideLeave(anna, james, await accountsOf(IDS.james))).toBe(false);
  });
});

describe("reading a task and changing one are the same permission", () => {
  it("lets a teammate edit work they can see", async () => {
    // Anna is on Nike, and neither wrote this nor is assigned to it. She
    // used to get a read-only panel and no way to fix a date in front of her.
    const anna = await load(IDS.anna);
    const taskId = await addTask({
      account: IDS.nike,
      assignees: [IDS.james],
      dueDay: 0,
    });
    const task = (await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) }))!;

    expect(await canViewTask(anna, task)).toBe(true);
    expect(await canEditTask(anna, task)).toBe(true);
  });

  it("still refuses another account's work", async () => {
    const anna = await load(IDS.anna);
    const taskId = await addTask({ account: IDS.adidas, assignees: [IDS.mika], dueDay: 0 });
    const task = (await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) }))!;

    expect(await canViewTask(anna, task)).toBe(false);
    expect(await canEditTask(anna, task)).toBe(false);
  });

  it("keeps an assignee on another account's board", async () => {
    // Assignment reaches across a board even when the account does not.
    const mika = await load(IDS.mika);
    const taskId = await addTask({ account: IDS.nike, assignees: [IDS.mika], dueDay: 0 });
    const task = (await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) }))!;

    expect(await canEditTask(mika, task)).toBe(true);
  });
});

/*
 * The case the whole shape exists for. Everything above still assumes one
 * account per person, because that is what most of the department looks like;
 * these are the ones that would have been impossible to express before.
 */
describe("a person on more than one account", () => {
  // Its own reset: every test here starts from one account per person and adds
  // the second itself, so none of them depends on what an earlier one left.
  beforeEach(async () => {
    await resetDb();
    await seedOrg();
  });

  it("reaches both, and still not a third", async () => {
    // Mika works on Adidas. Put her on Nike as well, the way a designer covering
    // two clients actually is.
    await addMembership(IDS.nike, IDS.mika);
    const mika = await load(IDS.mika);

    expect(mika.accountIds).toHaveLength(2);
    expect(canViewAccountWork(mika, IDS.nike)).toBe(true);
    expect(canViewAccountWork(mika, IDS.adidas)).toBe(true);
    // A made-up id stands in for the account she is not on. There are only two.
    expect(canViewAccountWork(mika, "00000000-0000-4000-a000-000000000000")).toBe(false);
  });

  it("is offered both accounts' boards, and the page opens every one", async () => {
    await addMembership(IDS.nike, IDS.mika);
    const mika = await load(IDS.mika);
    const offered = await listBoardsForUser(mika);

    expect(offered.map((b) => b.name).sort()).toEqual(["Adidas", "Nike"]);
    for (const board of offered) {
      expect(canViewAccountWork(mika, board.accountId)).toBe(true);
    }
  });

  it("hands their leave to the director of either one", async () => {
    // Sarah directs Nike and not Adidas. Once Mika works on Nike too, Mika's
    // leave becomes Sarah's to sign off — the request is the person's, not the
    // account's, and one shared account is enough.
    const sarah = await load(IDS.sarah);
    expect(canDecideLeave(sarah, await load(IDS.mika), await accountsOf(IDS.mika))).toBe(false);

    await addMembership(IDS.nike, IDS.mika);
    expect(canDecideLeave(sarah, await load(IDS.mika), await accountsOf(IDS.mika))).toBe(true);
  });

  it("does not make them a director of either", async () => {
    await addMembership(IDS.nike, IDS.mika);
    const mika = await load(IDS.mika);
    // Working on an account is not running it. `canViewAccount` gates the
    // management screen, and membership must never be mistaken for it.
    expect(canViewAccount(mika, IDS.nike)).toBe(false);
    expect(mika.directedIds).toEqual([]);
  });
});
