import { describe, expect, it } from "vitest";
import { ranksFor } from "./rank";

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
