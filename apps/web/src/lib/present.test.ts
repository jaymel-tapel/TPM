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
