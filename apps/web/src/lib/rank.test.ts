import { describe, expect, it } from "vitest";
import { ranksFor, weave } from "./rank";

const at = (entries: [string, number][]) => new Map(entries);

/**
 * A drop rewrites its column densely from the array the reader arranged. The
 * risk lives in what it *does not* write: a move of one slot must not touch
 * every row, and a stale id must not create a rank for a card that has gone.
 */
describe("ranksFor", () => {
  it("ranks a column nobody has placed yet", () => {
    // Every row at zero — the state every column is in until somebody drags.
    const writes = ranksFor(["a", "b", "c"], at([["a", 0], ["b", 0], ["c", 0]]));
    expect(writes).toEqual([
      { id: "a", position: 1 },
      { id: "b", position: 2 },
      { id: "c", position: 3 },
    ]);
  });

  it("starts at one, never zero", () => {
    // Zero means "unplaced" and sorts last, so a card dropped at the top of a
    // column has to outrank it.
    expect(ranksFor(["a"], at([["a", 0]]))[0]?.position).toBe(1);
  });

  it("writes only the band that moved", () => {
    // a b c d e, with c and d swapped: a, b and e keep the ranks they have.
    const current = at([["a", 1], ["b", 2], ["c", 3], ["d", 4], ["e", 5]]);
    const writes = ranksFor(["a", "b", "d", "c", "e"], current);
    expect(writes).toEqual([
      { id: "d", position: 3 },
      { id: "c", position: 4 },
    ]);
  });

  it("writes nothing when the arrangement is unchanged", () => {
    // What lets the action return early rather than posting a pointless write.
    expect(ranksFor(["a", "b"], at([["a", 1], ["b", 2]]))).toEqual([]);
  });

  it("drops an id the database has never heard of", () => {
    // Somebody else moved "b" out of this column mid-drag. The rest still
    // closes up densely rather than leaving a hole at rank 2.
    const writes = ranksFor(["a", "b", "c"], at([["a", 1], ["c", 3]]));
    expect(writes).toEqual([{ id: "c", position: 2 }]);
  });

  it("collapses a duplicated id to its first appearance", () => {
    const writes = ranksFor(["a", "a", "b"], at([["a", 0], ["b", 0]]));
    expect(writes).toEqual([
      { id: "a", position: 1 },
      { id: "b", position: 2 },
    ]);
  });
});

/**
 * The board never shows a whole column — twelve cards at most, and with a
 * filter on, a scattered few. What comes back from a drop is therefore partial,
 * and the cards it left out are the ones with everything to lose.
 */
describe("weave", () => {
  it("is the identity when the column was fully visible", () => {
    expect(weave(["a", "b", "c"], ["a", "c", "b"])).toEqual(["a", "c", "b"]);
  });

  it("permutes a filtered handful within its own slots", () => {
    // Reviews at 1, 3 and 5 of six, rearranged. a, b and c must not budge:
    // nobody could see them, so nobody moved them.
    const full = ["a", "r1", "b", "r2", "c", "r3"];
    expect(weave(full, ["r1", "r3", "r2"])).toEqual(["a", "r1", "b", "r3", "c", "r2"]);
  });

  it("leaves the column alone when nothing visible moved", () => {
    const full = ["a", "r1", "b", "r2"];
    expect(weave(full, ["r1", "r2"])).toEqual(full);
  });

  it("takes the slot of the neighbour a newcomer was dropped above", () => {
    // "new" arrives from another column, dropped between the two cards the
    // filter let through. It has no slot of its own, so it borrows the next.
    expect(weave(["x", "b", "y"], ["x", "new", "y"])).toEqual(["x", "b", "new", "y"]);
  });

  it("puts a newcomer dropped at the top above everything visible", () => {
    expect(weave(["x", "b", "y"], ["new", "x", "y"])).toEqual(["new", "x", "b", "y"]);
  });

  it("puts a newcomer dropped below the last visible card at the end", () => {
    expect(weave(["x", "b", "y"], ["x", "y", "new"])).toEqual(["x", "b", "y", "new"]);
  });

  it("is the whole arrangement when the column was empty", () => {
    expect(weave([], ["new"])).toEqual(["new"]);
  });

  it("changes nothing when the drop saw nothing", () => {
    expect(weave(["a", "b"], [])).toEqual(["a", "b"]);
  });

  it("does not let a doubled id swallow a slot", () => {
    const full = ["a", "r1", "b", "r2"];
    expect(weave(full, ["r2", "r2", "r1"])).toEqual(["a", "r2", "b", "r1"]);
  });
});
