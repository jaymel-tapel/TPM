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
