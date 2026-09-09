import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tags, taskTags, taskTypes, tasks } from "@/db/schema";
import { getBoardView, listAllTags, listBoardTags, listTagsWithUse } from "./tasks";
import { listTaskTypes, listTaskTypesWithUse } from "./task-types";
import { IDS, NOW, addTask, resetDb, seedOrg } from "../../test/fixture";

/**
 * Two vocabularies people can extend now, and the same rule under both:
 * retiring a word takes it out of circulation without taking it off the work
 * that already carries it. These pin that, and pin the thing a filter fed from
 * a URL has to survive.
 *
 * `task_types` is seeded by migration 0020 rather than by a test, and survives
 * `resetDb` because it is not in the truncate list — the vocabulary outlives
 * the work filed under it.
 */
const titles = async (filters = {}) => {
  const view = (await getBoardView(IDS.boardA, NOW, filters))!;
  return view.columns.flatMap((c) => c.tasks.map((t) => t.title));
};

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
  // Whatever an earlier test retired, since the table is never truncated.
  await db.update(taskTypes).set({ archivedAt: null });
  await db.delete(taskTypes).where(sql`${taskTypes.slug} not in
    ('client_work','internal','admin','review','meeting','creative')`);
});

describe("the kinds of work", () => {
  it("has the six the enum used to hold, in the order they were arranged", async () => {
    expect((await listTaskTypes()).map((t) => t.slug)).toEqual([
      "client_work",
      "review",
      "creative",
      "meeting",
      "internal",
      "admin",
    ]);
  });

  it("keeps each one's glyph and tone from before it was a row", async () => {
    const bySlug = new Map((await listTaskTypes()).map((t) => [t.slug, t]));
    expect(bySlug.get("client_work")).toMatchObject({ icon: "briefcase", tone: "blue" });
    expect(bySlug.get("admin")).toMatchObject({ icon: "settings", tone: "amber" });
  });

  it("files work under a kind somebody added", async () => {
    await db.insert(taskTypes).values({
      slug: "pitch",
      name: "Pitch",
      icon: "megaphone",
      tone: "amber",
      position: 9,
    });
    const id = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, type: "pitch" });
    await rename(id, "New business");

    expect(await titles({ type: "pitch" })).toEqual(["New business"]);
  });

  it("stops offering a retired kind but leaves the work wearing it", async () => {
    const id = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, type: "review" });
    await rename(id, "Still a review");
    await db.update(taskTypes).set({ archivedAt: new Date() }).where(eq(taskTypes.slug, "review"));

    expect((await listTaskTypes()).map((t) => t.slug)).not.toContain("review");
    // The card still resolves its kind, which is the whole point of retiring
    // rather than deleting.
    expect(await titles({ type: "review" })).toEqual(["Still a review"]);
    expect((await listTaskTypesWithUse()).find((t) => t.slug === "review")?.taskCount).toBe(1);
  });

  it("shows nothing for a kind nobody has ever had", async () => {
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    expect(await titles({ type: "no_such_kind" })).toEqual([]);
  });

  it("counts the work filed under each", async () => {
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, type: "meeting" });
    await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0, type: "meeting" });
    const counts = new Map((await listTaskTypesWithUse()).map((t) => [t.slug, t.taskCount]));
    expect(counts.get("meeting")).toBe(2);
    expect(counts.get("creative")).toBe(0);
  });
});

describe("tags", () => {
  it("offers every tag in use, and no retired one", async () => {
    const a = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    await tag(a, "nike");
    await tag(a, "aveda");
    await db.update(tags).set({ archivedAt: new Date() }).where(eq(tags.name, "aveda"));

    expect(await listAllTags()).toEqual(["nike"]);
    expect(await listBoardTags(IDS.boardA)).toEqual(["nike"]);
  });

  it("leaves a retired tag on the task that carries it", async () => {
    const a = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    await rename(a, "Tagged");
    await tag(a, "aveda");
    await db.update(tags).set({ archivedAt: new Date() }).where(eq(tags.name, "aveda"));

    // The card projection deliberately does not filter on `archived_at`: a tag
    // taken out of circulation is not a tag taken off last quarter's work.
    const view = (await getBoardView(IDS.boardA, NOW))!;
    const card = view.columns.flatMap((c) => c.tasks).find((t) => t.title === "Tagged");
    expect(card?.tags).toEqual(["aveda"]);
  });

  it("reports how much work carries each, retired ones included", async () => {
    const a = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    const b = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    await tag(a, "nike");
    await tag(b, "nike");
    await db.insert(tags).values({ id: "ffffbbbb-0001-4000-a000-000000000000", name: "unused" });

    const counts = new Map((await listTagsWithUse()).map((t) => [t.name, t.taskCount]));
    expect(counts.get("nike")).toBe(2);
    expect(counts.get("unused")).toBe(0);
  });
});
