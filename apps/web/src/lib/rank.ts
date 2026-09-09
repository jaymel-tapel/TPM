/**
 * Where cards sit in a board column.
 *
 * Kept out of the action for the reason `completion.ts` gives: everything
 * exported from a `"use server"` file has to be an async server action, so a
 * rule that wants testing directly cannot live there.
 */

/** The first rank. Zero is reserved for "nobody has placed this". */
export const FIRST_RANK = 1;

export type Ranked = { id: string; position: number };

/**
 * The rows a drop has to write, and no others.
 *
 * `order` is the column as the person arranging it saw it, top first; `current`
 * is what the database holds. Ids the database does not know are dropped —
 * somebody else moved that card while this drag was in the air, and the rest
 * of the arrangement is still worth honouring.
 *
 * Positions are rewritten densely from the array rather than nudged, so gaps
 * and duplicates left by any earlier edit heal themselves on the next drop.
 */
export function ranksFor(
  order: readonly string[],
  current: ReadonlyMap<string, number>,
): Ranked[] {
  const writes: Ranked[] = [];
  const seen = new Set<string>();
  let rank = FIRST_RANK;

  for (const id of order) {
    // A doubled id must not shift everything below it by one.
    if (seen.has(id) || !current.has(id)) continue;
    seen.add(id);
    if (current.get(id) !== rank) writes.push({ id, position: rank });
    rank += 1;
  }

  return writes;
}

/**
 * The column's full order after a drop that could only see part of it.
 *
 * A board column is not always shown whole: it is capped at twelve cards, and
 * with a filter on it shows a scattered handful rather than a prefix. The
 * arrangement that comes back from the browser is therefore a list of *some*
 * of the column, and ranking it directly would pull those cards to the top and
 * drop everything they were interleaved with behind them — silently, and only
 * visible once the filter comes off and an arrangement somebody made is gone.
 *
 * So the visible cards keep the slots they occupied. Only which visible card
 * sits in which visible slot changes; a card nobody could see does not move,
 * because nobody moved it. A card arriving from another column has no slot of
 * its own and takes the one belonging to the visible neighbour it was dropped
 * above, or the end of the column if it was dropped below all of them.
 *
 * When the whole column was visible this is the identity, which is why the
 * ordinary drag is unaffected.
 */
export function weave(full: readonly string[], visible: readonly string[]): string[] {
  const wanted = new Set(visible);
  const placed = new Set(full);
  // A doubled id would consume two slots and leave one card behind.
  const queue = [...new Set(visible)];

  const woven: string[] = [];
  let next = 0;

  for (const id of full) {
    if (!wanted.has(id)) {
      woven.push(id);
      continue;
    }
    /*
     * A slot. Fill it from the arrangement, bringing along any newcomer that
     * was placed above it — a card from another column is not in `full`, so it
     * does not close the slot and the loop keeps going until one does.
     */
    while (next < queue.length) {
      const id = queue[next];
      next += 1;
      woven.push(id);
      if (placed.has(id)) break;
    }
  }

  // Dropped below the last card the column let through.
  while (next < queue.length) {
    woven.push(queue[next]);
    next += 1;
  }

  return woven;
}
