import { describe, expect, it } from "vitest";
import { toTaskRow } from "./present";
import type { TaskCard } from "@/queries/sql";

const reference = new Date("2026-09-07T05:00:00Z"); // 1pm Manila, Sep 7

function task(overrides: Partial<TaskCard> = {}): TaskCard {
  return {
    id: "t1",
    title: "Send client performance report",
    description: null,
    type: "client_work",
    estimateMinutes: null,
    actualMinutes: null,
    statusId: "c-todo",
    statusName: "To Do",
    statusKind: "open",
    boardId: "b-1",
    boardName: "Team A",
    priority: "normal",
    dueDate: new Date("2026-09-07T06:00:00Z"), // 2pm today
    completedAt: null,
    teamId: "team-a",
    createdBy: "u1",
    assignees: [{ id: "u1", name: "Anna Santos" }],
    tags: [],
    docs: 0,
    ...overrides,
  };
}

/**
 * Overdue means carried over from an earlier day. Work due today and unfinished
 * is *remaining*. Conflating the two made the whole department read as a crisis
 * every evening, and is the easiest thing here to regress.
 */
describe("toTaskRow overdue", () => {
  it("is not overdue when due later today", () => {
    expect(toTaskRow(task(), reference).overdue).toBe(false);
  });

  it("is still not overdue once its time today has passed", () => {
    // Due 9am, it is now 1pm. Remaining, not overdue.
    const past = task({ dueDate: new Date("2026-09-07T01:00:00Z") });
    expect(toTaskRow(past, reference).overdue).toBe(false);
  });

  it("is overdue only once it carries into a later day", () => {
    const yesterday = task({ dueDate: new Date("2026-09-06T06:00:00Z") });
    expect(toTaskRow(yesterday, reference).overdue).toBe(true);
  });

  it("is never overdue once completed, however late", () => {
    const done = task({
      dueDate: new Date("2026-09-01T06:00:00Z"),
      completedAt: new Date("2026-09-05T06:00:00Z"),
      statusId: "c-done",
      statusName: "Done",
      statusKind: "done",
    });
    const row = toTaskRow(done, reference);
    expect(row.overdue).toBe(false);
    expect(row.done).toBe(true);
  });
});

describe("toTaskRow shape", () => {
  it("resolves the href and due text the design system cannot", () => {
    const row = toTaskRow(task(), reference);
    expect(row.href).toBe("/tasks/t1");
    expect(row.dueText).toMatch(/^Today, /);
  });

  it("carries assignees through so collaborators can render", () => {
    const shared = task({
      assignees: [
        { id: "u1", name: "Anna Santos" },
        { id: "u2", name: "James Cruz" },
      ],
    });
    expect(toTaskRow(shared, reference).assignees).toHaveLength(2);
  });
});

describe("a task row's overdue flag", () => {
  /*
   * This read false for every task in the product until the query layer
   * started making real Dates. `dueDate` arrived as the string Postgres
   * printed, and `string < Date` is a string-versus-number comparison that is
   * always false — so nothing ever rendered as late, on any screen, while
   * type-checking perfectly.
   */
  const card = (dueDate: Date, completedAt: Date | null = null) =>
    ({
      id: "t1",
      title: "Draft the brief",
      description: null,
      type: "client_work",
      priority: "normal",
      dueDate,
      estimateMinutes: null,
      actualMinutes: null,
      completedAt,
      teamId: "team",
      boardId: "board",
      boardName: "Board",
      createdBy: "u1",
      statusId: "s1",
      statusName: "To Do",
      statusKind: "open",
      assignees: [],
      tags: [],
      docs: 0,
    }) as Parameters<typeof toTaskRow>[0];

  const noon = new Date("2026-09-09T04:00:00Z"); // midday in Manila

  it("is true for work carried over from an earlier day", () => {
    expect(toTaskRow(card(new Date("2026-09-07T04:00:00Z")), noon).overdue).toBe(true);
  });

  it("is false for work due later today", () => {
    expect(toTaskRow(card(new Date("2026-09-09T08:00:00Z")), noon).overdue).toBe(false);
  });

  it("is false once it is done, however late it was", () => {
    const late = card(new Date("2026-09-01T04:00:00Z"), new Date("2026-09-08T04:00:00Z"));
    expect(toTaskRow(late, noon).overdue).toBe(false);
  });

  it("moves with the reader's timezone", () => {
    // 8pm on the 8th in Manila is still the 8th there — and midday on the 8th
    // in Los Angeles, which is also not yet over. Neither reader calls it late.
    const due = new Date("2026-09-08T12:00:00Z");
    const ref = new Date("2026-09-08T13:00:00Z");
    expect(toTaskRow(card(due), ref, "Asia/Manila").overdue).toBe(false);
    expect(toTaskRow(card(due), ref, "America/Los_Angeles").overdue).toBe(false);
  });
});
