import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { IDS, NOW, addActivity, addTask, resetDb, seedOrg, statusId } from "../../test/fixture";
import { getActivity } from "./activity";

describe("a task's activity", () => {
  let taskId: string;

  beforeEach(async () => {
    await resetDb();
    await seedOrg();
    taskId = await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 0 });
  });

  it("reads oldest first, whatever order it was written in", async () => {
    await addActivity({ taskId, actorId: IDS.anna, kind: "comment", body: "second", minutesAgo: 10 });
    await addActivity({ taskId, actorId: IDS.anna, kind: "created", toLabel: "To Do", minutesAgo: 60 });

    const { entries } = await getActivity(taskId);
    expect(entries.map((e) => e.kind)).toEqual(["created", "comment"]);
  });

  it("keeps the newest when it cannot keep everything, still in order", async () => {
    // Rendering a comment costs a whole editor, so the feed is capped. The cap
    // has to drop the *oldest*, not whatever the database happened to return.
    for (let i = 0; i < 5; i += 1) {
      await addActivity({
        taskId,
        actorId: IDS.anna,
        kind: "comment",
        body: `c${i}`,
        minutesAgo: 100 - i,
      });
    }

    const { entries, total } = await getActivity(taskId, 3);
    expect(total).toBe(5);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.body)).toEqual(["c2", "c3", "c4"]);
  });

  it("orders rows written in the same instant deterministically", async () => {
    /*
     * `defaultNow()` is transaction time, so a save that changes three
     * assignees writes three rows sharing a timestamp to the microsecond.
     * Without the id as a tiebreak the order is undefined, and a paged feed
     * can drop or repeat one.
     */
    await db.execute(sql`
      insert into task_activity (task_id, actor_id, kind, subject_name)
      values (${taskId}, ${IDS.anna}, 'assigned', 'A'),
             (${taskId}, ${IDS.anna}, 'assigned', 'B'),
             (${taskId}, ${IDS.anna}, 'assigned', 'C')
    `);

    const first = await getActivity(taskId);
    const second = await getActivity(taskId);
    expect(first.entries.map((e) => e.id)).toEqual(second.entries.map((e) => e.id));
  });

  it("names the person who did it", async () => {
    await addActivity({ taskId, actorId: IDS.sarah, kind: "completed", toLabel: "Done" });
    const { entries } = await getActivity(taskId);
    expect(entries[0]).toMatchObject({ actorName: "Sarah Lim", kind: "completed" });
  });

  it("survives the column it names being renamed", async () => {
    /*
     * The reason labels are snapshots rather than references. A board owner can
     * rename a column at any time; "Sarah moved this to In Progress" has to keep
     * reading the way it read when it happened, or the log is fiction.
     */
    await addActivity({
      taskId,
      actorId: IDS.sarah,
      kind: "status_changed",
      fromLabel: "To Do",
      toLabel: "In Progress",
    });

    await db.execute(
      sql`update board_statuses set name = 'Doing' where id = ${statusId(IDS.boardA, "in_progress")}`,
    );

    const { entries } = await getActivity(taskId);
    expect(entries[0]!.toLabel).toBe("In Progress");
  });

  it("survives the column it names being deleted", async () => {
    await addActivity({ taskId, actorId: IDS.sarah, kind: "status_changed", toLabel: "Blocked" });

    // Nothing sits in Blocked, so a board owner may remove it. History must not
    // go with it — an FK here would have cascaded this row away.
    await db.execute(
      sql`delete from board_statuses where id = ${statusId(IDS.boardA, "blocked")}`,
    );

    const { entries } = await getActivity(taskId);
    expect(entries[0]!.toLabel).toBe("Blocked");
  });

  it("goes when the task goes", async () => {
    await addActivity({ taskId, actorId: IDS.anna, kind: "comment", body: "x" });
    await db.execute(sql`delete from tasks where id = ${taskId}`);

    const { total } = await getActivity(taskId);
    expect(total).toBe(0);
  });
});

describe("logged time", () => {
  let taskId: string;

  beforeEach(async () => {
    await resetDb();
    await seedOrg();
    taskId = await addTask({ account: IDS.nike, assignees: [IDS.anna], dueDay: 0 });
  });

  const actual = async () =>
    (
      await db.execute(sql`select actual_minutes from tasks where id = ${taskId}`)
    ).rows[0] as { actual_minutes: number | null };

  it("keeps the task's total as the sum of its entries", async () => {
    await addActivity({ taskId, actorId: IDS.anna, kind: "time_logged", minutes: 90 });
    await addActivity({ taskId, actorId: IDS.james, kind: "time_logged", minutes: 30 });
    await syncActual(taskId);

    expect((await actual()).actual_minutes).toBe(120);
  });

  it("falls back to nothing logged rather than zero when the last entry goes", async () => {
    // Null and 0 are different answers: "nobody logged" versus "logged none".
    const id = await addActivity({
      taskId,
      actorId: IDS.anna,
      kind: "time_logged",
      minutes: 45,
    });
    await syncActual(taskId);
    expect((await actual()).actual_minutes).toBe(45);

    await db.execute(sql`delete from task_activity where id = ${id}`);
    await syncActual(taskId);
    expect((await actual()).actual_minutes).toBeNull();
  });

  it("ignores comments when it adds the time up", async () => {
    await addActivity({ taskId, actorId: IDS.anna, kind: "time_logged", minutes: 60 });
    await addActivity({ taskId, actorId: IDS.anna, kind: "comment", body: "took a while" });
    await syncActual(taskId);

    expect((await actual()).actual_minutes).toBe(60);
  });

  it("carries the amount into the feed", async () => {
    await addActivity({ taskId, actorId: IDS.james, kind: "time_logged", minutes: 150 });
    const { entries } = await getActivity(taskId);
    expect(entries[0]).toMatchObject({ kind: "time_logged", minutes: 150 });
  });
});

/** The recompute the action does, mirrored so the test exercises the rule. */
async function syncActual(taskId: string) {
  await db.execute(sql`
    update tasks set actual_minutes = (
      select sum(minutes) from task_activity
      where task_id = ${taskId} and kind = 'time_logged'
    ) where id = ${taskId}
  `);
}
