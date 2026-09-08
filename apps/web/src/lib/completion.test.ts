import { describe, expect, it } from "vitest";
import { completionOnMove } from "./completion";

describe("what moving a card does to completion", () => {
  const tuesday = new Date("2026-09-08T10:00:00Z");

  it("marks work done when it lands on the finish line", () => {
    const at = completionOnMove("done", null);
    expect(at).toBeInstanceOf(Date);
  });

  it("leaves unfinished work unfinished at every other stage", () => {
    expect(completionOnMove("open", null)).toBeNull();
    expect(completionOnMove("blocked", null)).toBeNull();
  });

  it("does not un-finish work dragged back off the finish line", () => {
    /*
     * The bug this replaced. `completed_at` used to be derived from whichever
     * column a card sat in, so dragging one out of Done erased the fact that
     * it was finished on Tuesday — and last week's report changed with it.
     */
    expect(completionOnMove("open", tuesday)).toBe(tuesday);
    expect(completionOnMove("blocked", tuesday)).toBe(tuesday);
  });

  it("keeps the original time when work moves on past the finish line", () => {
    // Delivered → Invoiced. It was finished when it was finished; passing
    // through a later stage does not re-date it.
    expect(completionOnMove("done", tuesday)).toBe(tuesday);
  });

  it("never invents a second completion date", () => {
    const first = completionOnMove("done", null)!;
    expect(completionOnMove("done", first)).toBe(first);
  });
});
