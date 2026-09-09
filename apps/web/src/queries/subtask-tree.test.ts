import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { depthOf, listAncestors, listSubtaskTree } from "./tasks";
import { IDS, addTask, resetDb, seedOrg } from "../../test/fixture";

/**
 * Pieces have pieces now, so three questions moved from "cannot happen" to
 * "must be right": how deep a task sits, what the whole branch below it is,
 * and how you got there. All three are recursive walks, which is exactly the
 * shape that goes wrong quietly — a missing bound loops, a missing filter
 * climbs into somebody else's tree.
 */
const chain = async (depth: number) => {
  const ids: string[] = [];
  let parent: string | undefined;
  for (let i = 0; i < depth; i += 1) {
    const id = await addTask({
      account: IDS.volvo,
      assignees: [IDS.anna],
      dueDay: 0,
      dueHour: 9 + i,
      parent,
    });
    await db.update(tasks).set({ title: `L${i}` }).where(eq(tasks.id, id));
    ids.push(id);
    parent = id;
  }
  return ids;
};

beforeEach(async () => {
  await resetDb();
  await seedOrg();
});

describe("how deep a task sits", () => {
  it("calls a task nobody filed under anything zero", async () => {
    const [root] = await chain(1);
    expect(await depthOf(root!)).toBe(0);
  });

  it("counts every level above it", async () => {
    const ids = await chain(4);
    expect(await depthOf(ids[1]!)).toBe(1);
    expect(await depthOf(ids[3]!)).toBe(3);
  });
});

describe("the branch below a task", () => {
  it("returns every level, not just the children", async () => {
    const ids = await chain(4);
    const branch = await listSubtaskTree(ids[0]!);
    expect(branch.map((t) => t.title).sort()).toEqual(["L1", "L2", "L3"]);
  });

  it("carries the parent each row names, so the tree can be rebuilt", async () => {
    const ids = await chain(3);
    const branch = await listSubtaskTree(ids[0]!);
    const parents = new Map(branch.map((t) => [t.title, t.parentId]));
    expect(parents.get("L1")).toBe(ids[0]);
    expect(parents.get("L2")).toBe(ids[1]);
  });

  it("keeps containers, which every level above a leaf now is", async () => {
    // `runTaskQuery` drops containers by default — a branch that vanished
    // would take its own children off the page with it.
    const ids = await chain(3);
    expect((await listSubtaskTree(ids[0]!)).length).toBe(2);
  });

  it("stays inside its own branch", async () => {
    const mine = await chain(2);
    const theirs = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    await db.update(tasks).set({ title: "Somebody else" }).where(eq(tasks.id, theirs));
    expect((await listSubtaskTree(mine[0]!)).map((t) => t.title)).toEqual(["L1"]);
  });

  it("is empty for a task nobody has broken down", async () => {
    const [root] = await chain(1);
    expect(await listSubtaskTree(root!)).toEqual([]);
  });

  it("stops at the depth it is given rather than walking forever", async () => {
    // The bound is what makes a cycle that somehow reached the table a slow
    // query rather than a hung page.
    const ids = await chain(5);
    expect((await listSubtaskTree(ids[0]!, 2)).map((t) => t.title).sort()).toEqual(["L1", "L2"]);
  });
});

describe("the path back up", () => {
  it("lists the chain outermost first, excluding the task itself", async () => {
    const ids = await chain(4);
    const path = await listAncestors(ids[3]!);
    expect(path.map((p) => p.title)).toEqual(["L0", "L1", "L2"]);
  });

  it("is empty at the top, where the way out is the day", async () => {
    const [root] = await chain(1);
    expect(await listAncestors(root!)).toEqual([]);
  });
});
