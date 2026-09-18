import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { collectPeople } from "@tpm/ui/editor";
import { db } from "@/db";
import { notifications, tasks, users, type Task, type User } from "@/db/schema";
import { canViewTask } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { IDS, addTask, bodyNaming, resetDb, seedOrg, viewerFor } from "../../test/fixture";
import { filterUsersWhoCanSeeTask, getInbox, getUnreadCount } from "./notifications";

/** The `Viewer` a page would have been handed — accounts resolved, as in a session. */
const load = viewerFor;

const loadTask = async (id: string): Promise<Task> => {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!task) throw new Error(`no such task ${id}`);
  return task;
};

describe("who may be told about a task", () => {
  let task: Task;

  beforeEach(async () => {
    await resetDb();
    await seedOrg();
    task = await loadTask(await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 }));
  });

  it("agrees with canViewTask, person by person", async () => {
    /*
     * The two answers must match exactly. Where they drift, the inbox either
     * hides something a person may read or advertises a task that 404s when
     * they follow it — the same failure that split `canViewAccount` from
     * `canViewAccountWork`.
     */
    const everyone = [IDS.anna, IDS.james, IDS.sarah, IDS.mika, IDS.elena];
    const allowed = new Set(await filterUsersWhoCanSeeTask(task, everyone));

    for (const id of everyone) {
      const viewer = await load(id);
      expect([id, allowed.has(id)]).toEqual([id, await canViewTask(viewer, task)]);
    }
  });

  it("refuses a name from outside the account, however the mention got there", async () => {
    /*
     * The security case. `userId` arrives inside BlockNote JSON the browser
     * composed, so a hand-written payload can name anyone in the department.
     * Without this filter, `@`-mentioning becomes a way to push text at any of
     * the thirty and to leak another account's task titles into their inbox.
     */
    const forged = bodyNaming("thoughts? ", [{ id: IDS.mika, name: "Mika Villanueva" }]);

    const told = await notify({
      task,
      actorId: IDS.anna,
      kind: "mentioned",
      userIds: collectPeople(forged).map((p) => p.userId),
    });

    expect(told).toEqual([]);
    expect(await getUnreadCount(IDS.mika)).toBe(0);
    expect(await getInbox(IDS.mika)).toEqual([]);
  });

  it("tells a teammate who was named", async () => {
    const body = bodyNaming("over to you ", [{ id: IDS.james, name: "James Cruz" }]);
    const told = await notify({
      task,
      actorId: IDS.anna,
      kind: "mentioned",
      userIds: collectPeople(body).map((p) => p.userId),
    });

    expect(told).toEqual([IDS.james]);
    expect(await getUnreadCount(IDS.james)).toBe(1);
  });

  it("never tells you about your own doing", async () => {
    await notify({
      task,
      actorId: IDS.anna,
      kind: "mentioned",
      userIds: [IDS.anna, IDS.james],
    });

    expect(await getUnreadCount(IDS.anna)).toBe(0);
    expect(await getUnreadCount(IDS.james)).toBe(1);
  });

  it("tells the senior director, who sits on no account", async () => {
    // Elena's `account_id` is null, so a rule written as "same account" alone would
    // silently exclude the one person who can see everything.
    const told = await notify({
      task,
      actorId: IDS.anna,
      kind: "mentioned",
      userIds: [IDS.elena],
    });
    expect(told).toEqual([IDS.elena]);
  });
});

describe("an inbox", () => {
  let task: Task;

  beforeEach(async () => {
    await resetDb();
    await seedOrg();
    task = await loadTask(await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 }));
  });

  const activityOn = async (body: string) => {
    const [row] = await db.execute(sql`
      insert into task_activity (task_id, actor_id, kind, body)
      values (${task.id}, ${IDS.anna}, 'comment', ${body})
      returning id
    `).then((r) => r.rows as unknown as { id: string }[]);
    return row!.id;
  };

  it("says who, on what, and quotes the comment as plain text", async () => {
    const activityId = await activityOn(
      bodyNaming("can you take this ", [{ id: IDS.james, name: "James Cruz" }]),
    );
    await notify({
      task,
      actorId: IDS.anna,
      kind: "mentioned",
      activityId,
      userIds: [IDS.james],
    });

    const [entry] = await getInbox(IDS.james);
    expect(entry).toMatchObject({
      kind: "mentioned",
      actorName: "Anna Santos",
      taskId: task.id,
    });
    /*
     * Flattened here, never handed over as a document — an inbox row must not
     * cost a BlockNote instance. A mention reads as the bare name because the
     * same flattening feeds `documents.search_text`, where searching "James"
     * has to match.
     */
    expect(entry!.excerpt).toBe("can you take this James Cruz");
    expect(entry!.readAt).toBeNull();
    /*
     * A real Date, not the string Postgres printed. The feed formats this with
     * `agoLabel`, which calls `.getTime()` — a string gets all the way to the
     * page before it fails.
     */
    expect(entry!.createdAt).toBeInstanceOf(Date);
  });

  it("tells one person about one comment once, however often it is retried", async () => {
    const activityId = await activityOn("{}");
    for (let i = 0; i < 3; i += 1) {
      await notify({
        task,
        actorId: IDS.anna,
        kind: "mentioned",
        activityId,
        userIds: [IDS.james],
      });
    }
    expect(await getUnreadCount(IDS.james)).toBe(1);
  });

  it("goes when the comment it points at goes", async () => {
    const activityId = await activityOn("{}");
    await notify({
      task,
      actorId: IDS.anna,
      kind: "mentioned",
      activityId,
      userIds: [IDS.james],
    });
    expect(await getUnreadCount(IDS.james)).toBe(1);

    await db.execute(sql`delete from task_activity where id = ${activityId}`);

    // A notification is a nudge, not history: it must not outlive the thing it
    // is a nudge about and link somewhere that no longer says anything.
    expect(await getUnreadCount(IDS.james)).toBe(0);
  });

  it("goes when the task goes", async () => {
    await notify({ task, actorId: IDS.anna, kind: "assigned", userIds: [IDS.james] });
    await db.execute(sql`delete from tasks where id = ${task.id}`);
    expect(await getInbox(IDS.james)).toEqual([]);
  });

  it("counts only what is unread, and stops counting once read", async () => {
    await notify({ task, actorId: IDS.anna, kind: "assigned", userIds: [IDS.james] });
    expect(await getUnreadCount(IDS.james)).toBe(1);

    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.userId, IDS.james));

    expect(await getUnreadCount(IDS.james)).toBe(0);
    // Read, not gone — the inbox is still a list of what happened.
    const [read] = await getInbox(IDS.james);
    expect(read!.readAt).toBeInstanceOf(Date);
  });

  it("reads newest first", async () => {
    const older = await activityOn("{}");
    const newer = await activityOn("{}");
    await notify({ task, actorId: IDS.anna, kind: "mentioned", activityId: older, userIds: [IDS.james] });
    await notify({ task, actorId: IDS.anna, kind: "commented", activityId: newer, userIds: [IDS.james] });

    await db.execute(sql`
      update notifications set created_at = now() - interval '1 hour'
      where kind = 'mentioned'
    `);

    expect((await getInbox(IDS.james)).map((e) => e.kind)).toEqual(["commented", "mentioned"]);
  });

  it("keeps one person's inbox out of another's", async () => {
    await notify({ task, actorId: IDS.anna, kind: "assigned", userIds: [IDS.james] });
    expect(await getInbox(IDS.sarah)).toEqual([]);
  });
});

describe("work that belongs to no account", () => {
  let root: Task;

  beforeEach(async () => {
    await resetDb();
    await seedOrg();
    const id = await addTask({ account: IDS.volvo, assignees: [IDS.anna], dueDay: 0 });
    await db.execute(sql`update tasks set account_id = null where id = ${id}`);
    root = await loadTask(id);
  });

  it("can be seen by everyone, and told to everyone", async () => {
    /*
     * The invariant this file exists to protect, at the one point it is
     * easiest to break. `u.account_id = NULL` is never true, so the notification
     * filter would quietly tell nobody while `canViewTask` said the whole
     * department could read it.
     */
    const everyone = [IDS.anna, IDS.james, IDS.sarah, IDS.mika, IDS.elena];
    const allowed = new Set(await filterUsersWhoCanSeeTask(root, everyone));

    for (const id of everyone) {
      const viewer = await load(id);
      expect([id, allowed.has(id)]).toEqual([id, await canViewTask(viewer, root)]);
    }
    // And that answer is "yes" — including for someone on the other account.
    expect(allowed.has(IDS.mika)).toBe(true);
  });
});
