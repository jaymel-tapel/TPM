import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { getBoardView } from "./tasks";
import { COLUMNS, IDS, NOW, addTask, resetDb, seedOrg, statusId } from "../../test/fixture";

/**
 * The board is the only screen that reads `position`, and zero is not a rank —
 * it is "nobody has placed this". These pin the two halves of that: an
 * untouched column reads exactly as it always did, and once somebody arranges
 * one, work arriving later joins the bottom rather than landing on top of the
 * arrangement.
 */
const todo = statusId(IDS.boardA, "todo");

const titles = async () => {
  const view = await getBoardView(IDS.boardA, NOW);
  return view!.columns.find((c) => c.id === todo)!.tasks.map((t) => t.title);
};

beforeEach(async () => {
  await resetDb();
  await seedOrg();
});

describe("a column nobody has dragged in", () => {
  it("reads by priority then due date, exactly as before", async () => {
    const normal = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, dueHour: 9 });
    const urgent = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, dueHour: 17 });
    await db.update(tasks).set({ priority: "urgent", title: "Urgent" }).where(eq(tasks.id, urgent));
    await db.update(tasks).set({ title: "Normal" }).where(eq(tasks.id, normal));

    // Urgent leads despite being due later — every row is still position 0.
    expect(await titles()).toEqual(["Urgent", "Normal"]);
  });
});

describe("once a column is arranged", () => {
  it("puts a placed card above one nobody has placed", async () => {
    const placed = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, dueHour: 17 });
    const urgent = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, dueHour: 9 });
    await db.update(tasks).set({ priority: "urgent", title: "Urgent" }).where(eq(tasks.id, urgent));
    await db.update(tasks).set({ position: 1, title: "Placed" }).where(eq(tasks.id, placed));

    // This is the trade manual ranking makes: somebody said "this one first",
    // and that outranks the urgent card the sort would have led with.
    expect(await titles()).toEqual(["Placed", "Urgent"]);
  });

  it("keeps placed cards in the order they were placed", async () => {
    const first = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, dueHour: 9 });
    const second = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, dueHour: 10 });
    // Reversed against the due-date sort, so only `position` can explain it.
    await db.update(tasks).set({ position: 2, title: "Second" }).where(eq(tasks.id, first));
    await db.update(tasks).set({ position: 1, title: "First" }).where(eq(tasks.id, second));

    expect(await titles()).toEqual(["First", "Second"]);
  });

  it("lands new work at the bottom rather than on top of the arrangement", async () => {
    const placed = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, dueHour: 17 });
    await db.update(tasks).set({ position: 1, title: "Placed" }).where(eq(tasks.id, placed));

    // Created afterwards, urgent, due earlier — and still below, because
    // nobody has said where it goes.
    const fresh = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0, dueHour: 8 });
    await db.update(tasks).set({ priority: "urgent", title: "Fresh" }).where(eq(tasks.id, fresh));

    expect(await titles()).toEqual(["Placed", "Fresh"]);
  });
});

describe("the columns stay separate", () => {
  it("ranks within a column, not across the board", async () => {
    const inTodo = await addTask({ team: IDS.teamA, assignees: [IDS.anna], dueDay: 0 });
    const inDoing = await addTask({
      team: IDS.teamA,
      assignees: [IDS.anna],
      dueDay: 0,
      status: COLUMNS[1],
    });
    await db.update(tasks).set({ position: 1 }).where(eq(tasks.id, inTodo));
    await db.update(tasks).set({ position: 1 }).where(eq(tasks.id, inDoing));

    // The same rank in two columns is not a conflict: a column is the scope.
    const view = await getBoardView(IDS.boardA, NOW);
    expect(view!.columns.find((c) => c.id === todo)!.tasks).toHaveLength(1);
    expect(
      view!.columns.find((c) => c.id === statusId(IDS.boardA, COLUMNS[1]))!.tasks,
    ).toHaveLength(1);
  });
});
