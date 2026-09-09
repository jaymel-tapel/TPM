import { describe, expect, it } from "vitest";
import { toAvailability, toLeaveRequest, toMemberRow, toTaskRow } from "./present";
import type { TaskCard } from "@/queries/sql";
import type { LeaveRow } from "@/queries/leave";
import type { MemberRollup } from "@/queries/accounts";
import type { User } from "@/db/schema";

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
    boardName: "Volvo",
    priority: "normal",
    dueDate: new Date("2026-09-07T06:00:00Z"), // 2pm today
    completedAt: null,
    accountId: "account-a",
    accountName: "Volvo",
    campaignId: null,
    createdBy: "u1",
    parentId: null,
    parentTitle: null,
    childCount: 0,
    childrenDone: 0,
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
      accountId: "account",
      accountName: "Volvo",
      campaignId: null,
      boardId: "board",
      boardName: "Board",
      createdBy: "u1",
      statusId: "s1",
      statusName: "To Do",
      statusKind: "open",
      parentId: null,
      parentTitle: null,
      childCount: 0,
      childrenDone: 0,
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

/* ── Leave ──────────────────────────────────────────────────────────────── */

const MANILA = "Asia/Manila";

function leave(overrides: Partial<LeaveRow> = {}): LeaveRow {
  return {
    id: "l1",
    userId: "u1",
    userName: "Anna Santos",
    role: "team_member",
    kind: "vacation",
    status: "pending",
    startDate: "2026-09-07",
    endDate: "2026-09-11",
    half: null,
    note: null,
    decidedByName: null,
    decidedAt: null,
    createdAt: reference,
    ...overrides,
  };
}

const viewer = (overrides: Partial<User> = {}) =>
  ({ id: "u1", role: "team_member", accountId: "account-a", ...overrides }) as User;

describe("toAvailability", () => {
  it("says when they are back, but only while that is still ahead", () => {
    const until = toAvailability(
      { away: "full", kind: "vacation", endDate: "2026-09-11" },
      reference,
      MANILA,
    );
    expect(until?.label).toBe("Away until 11 Sep");

    // On the last day of the run, "away until today" is a worse sentence.
    const last = toAvailability(
      { away: "full", kind: "vacation", endDate: "2026-09-07" },
      reference,
      MANILA,
    );
    expect(last?.label).toBe("Away today");
  });

  it("names the half of the day", () => {
    expect(
      toAvailability({ away: "am", kind: "personal", endDate: "2026-09-07" }, reference, MANILA)
        ?.label,
    ).toBe("Away this morning");
    expect(
      toAvailability({ away: "pm", kind: "personal", endDate: "2026-09-07" }, reference, MANILA)
        ?.label,
    ).toBe("Away this afternoon");
  });

  it("is null for somebody who is in", () => {
    expect(toAvailability(null, reference, MANILA)).toBeNull();
  });
});

describe("toLeaveRequest", () => {
  it("names who it is waiting on, from the org chart", () => {
    expect(toLeaveRequest(leave(), viewer(), reference, MANILA).decisionText).toBe(
      "Waiting on the Account Director",
    );
    // A director's own request has exactly one person left who can settle it,
    // and nothing has to name that as a special case.
    expect(
      toLeaveRequest(leave({ role: "account_director" }), viewer(), reference, MANILA)
        .decisionText,
    ).toBe("Waiting on the Senior Director");
  });

  it("reports a decision once it is made", () => {
    const row = leave({ status: "approved", decidedByName: "Sarah Lim" });
    expect(toLeaveRequest(row, viewer(), reference, MANILA).decisionText).toBe(
      "Approved by Sarah Lim",
    );
  });

  it("counts the weekdays in the range", () => {
    // 7-11 September 2026 is Monday to Friday.
    expect(toLeaveRequest(leave(), viewer(), reference, MANILA).lengthText).toBe("5 days");
    expect(
      toLeaveRequest(
        leave({ startDate: "2026-09-09", endDate: "2026-09-09", half: "pm" }),
        viewer(),
        reference,
        MANILA,
      ).lengthText,
    ).toBe("Half day (PM)");
  });

  it("offers cancel only to the filer, and only while there is time left", () => {
    expect(toLeaveRequest(leave(), viewer(), reference, MANILA).cancellable).toBe(true);

    // Somebody else's row is never yours to withdraw.
    expect(
      toLeaveRequest(leave(), viewer({ id: "u2" }), reference, MANILA).cancellable,
    ).toBe(false);

    // Leave already taken stays on the record.
    expect(
      toLeaveRequest(
        leave({ startDate: "2026-09-01", endDate: "2026-09-04" }),
        viewer(),
        reference,
        MANILA,
      ).cancellable,
    ).toBe(false);

    // A settled request has nothing to withdraw.
    expect(
      toLeaveRequest(leave({ status: "declined" }), viewer(), reference, MANILA).cancellable,
    ).toBe(false);
  });
});

describe("toMemberRow", () => {
  const rollup = (overrides: Partial<MemberRollup> = {}): MemberRollup => ({
    id: "u1",
    name: "Anna Santos",
    role: "team_member",
    title: "Designer",
    due: 6,
    done: 3,
    overdue: 1,
    remaining: 3,
    percent: 50,
    away: null,
    ...overrides,
  });

  it("builds a link from the base path it is given", () => {
    expect(toMemberRow(rollup(), "/account", reference, MANILA).href).toBe("/account/u1");
  });

  it("gives no link at all when there is nowhere to go", () => {
    // A team member may open their own day and nobody else's, so most rows on
    // their roster are not links. A row that looks clickable and 404s is worse
    // than a row that does not.
    expect(toMemberRow(rollup(), null, reference, MANILA).href).toBeNull();
  });

  it("carries the counts through untouched", () => {
    const row = toMemberRow(rollup(), "/account", reference, MANILA);
    expect([row.done, row.remaining, row.overdue, row.percent]).toEqual([3, 3, 1, 50]);
  });

  it("passes the away marker through as a written label", () => {
    const row = toMemberRow(
      rollup({ away: { away: "full", kind: "vacation", endDate: "2026-09-11" } }),
      "/account",
      reference,
      MANILA,
    );
    expect(row.away?.label).toBe("Away until 11 Sep");
    // Shown, never subtracted: the percentage is the one the rollup counted.
    expect(row.percent).toBe(50);
  });
});
