import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tags, taskTags, tasks } from "@/db/schema";
import { getBoardView, listBoardTags } from "./tasks";
import { IDS, NOW, addTask, resetDb, seedOrg } from "../../test/fixture";

/**
 * Narrowing happens in the query, not after it — which is the only reason the
 * count in a column header can be trusted. These pin that, and pin the thing a
 * filter fed from a URL has to survive: a value that is not a value.
 */
const board = async (filters = {}, assignee: string | null = null) =>
  (await getBoardView(IDS.boardA, NOW, { ...filters, assigneeId: assignee }))!;

const titles = (view: Awaited<ReturnType<typeof board>>) =>
  view.columns.flatMap((c) => c.tasks.map((t) => t.title));

const tagIds = new Map<string, string>();
const tag = async (taskId: string, name: string) => {
  let id = tagIds.get(name);
  if (!id) {
    id = `ffffaaaa-${String(tagIds.size + 1).padStart(4, "0")}-4000-a000-000000000000`;
    tagIds.set(name, id);
    await db.insert(tags).values({ id, name });
  }
  await db.insert(taskTags).values({ taskId, tagId: id });
};

const rename = (id: string, title: string) =>
  db.update(tasks).set({ title }).where(eq(tasks.id, id));

beforeEach(async () => {
  await resetDb();
  await seedOrg();
  tagIds.clear();
});

describe("filtering a board", () => {
  it("shows one type and drops the rest", async () => {
    const review = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, type: "review" });
    const meeting = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, type: "meeting" });
    await rename(review, "Review");
    await rename(meeting, "Meeting");

    expect(titles(await board())).toHaveLength(2);
    expect(titles(await board({ type: "review" }))).toEqual(["Review"]);
  });

  it("counts what is on the screen, not what is on the board", async () => {
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, type: "review" });
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, type: "meeting" });
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, type: "meeting" });

    // A header reading "3" over one card would be reporting on a board nobody
    // is looking at.
    expect((await board({ type: "review" })).total).toBe(1);
  });

  it("shows one priority and drops the rest", async () => {
    const urgent = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    await db.update(tasks).set({ priority: "urgent", title: "Urgent" }).where(eq(tasks.id, urgent));

    expect(titles(await board({ priority: "urgent" }))).toEqual(["Urgent"]);
  });

  it("matches a tag through the join", async () => {
    const nike = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    await rename(nike, "Nike");
    await tag(nike, "nike");

    expect(titles(await board({ tag: "nike" }))).toEqual(["Nike"]);
  });

  it("shows nothing for a tag nobody has used", async () => {
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    // Text, not an enum — an unknown one is a legitimate query with no answer.
    expect(titles(await board({ tag: "no-such-tag" }))).toEqual([]);
  });

  it("ignores a type that is not a type rather than throwing", async () => {
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    // A bookmark kept past a rename must show the board, not an error page.
    expect(titles(await board({ type: "not_a_type" }))).toHaveLength(1);
    expect(titles(await board({ priority: "extremely" }))).toHaveLength(1);
  });

  it("composes with My Tasks rather than replacing it", async () => {
    const mine = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, type: "review" });
    await addTask({ account: IDS.volvo, assignees: [IDS.james], dueDay: 0, type: "review" });
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, type: "meeting" });
    await rename(mine, "Mine and a review");

    expect(titles(await board({ type: "review" }, IDS.anna))).toEqual(["Mine and a review"]);
  });
});

describe("the tags a board's filter offers", () => {
  it("lists only the tags in use on that board, once each, sorted", async () => {
    const a = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    const b = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    const other = await addTask({ account: IDS.mg, assignees: [IDS.mika], dueDay: 0 });
    await tag(a, "nike");
    await tag(b, "nike");
    await tag(b, "aveda");
    await tag(other, "halcyon");

    // "halcyon" belongs to the other team's board: offering it here would be a
    // menu entry that can only ever show an empty board.
    expect(await listBoardTags(IDS.boardA)).toEqual(["aveda", "nike"]);
  });

  it("offers nothing on a board whose work carries no tags", async () => {
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    expect(await listBoardTags(IDS.boardA)).toEqual([]);
  });
});
