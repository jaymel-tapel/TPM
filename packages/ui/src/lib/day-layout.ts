/**
 * Arranging overlapping boxes in a column — the calendar rule, and pure
 * geometry, so it lives with the component that draws it rather than in the
 * app. `apps/web/src/lib/plan.test.ts` covers it, the way `blocks.test.ts`
 * already covers this package's editor helpers.
 */
export type Span = { startMinutes: number; minutes: number };

export type Positioned<T> = T & {
  /** Fractions of the column width, 0–1. */
  left: number;
  width: number;
};

/**
 * Blocks that overlap share the width. Blocks that merely touch — one ending
 * at ten, the next starting at ten — do not: getting that wrong renders a tidy
 * back-to-back morning as two narrow columns, and is the tell that someone
 * reached for `<=`.
 */
export function layoutBlocks<T extends Span>(blocks: T[]): Positioned<T>[] {
  const order = [...blocks].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.minutes - b.minutes,
  );

  const out: Positioned<T>[] = [];
  let group: T[] = [];
  let groupEnd = -1;

  const flush = () => {
    group.forEach((block, i) =>
      out.push({ ...block, left: i / group.length, width: 1 / group.length }),
    );
    group = [];
    groupEnd = -1;
  };

  for (const block of order) {
    if (group.length > 0 && block.startMinutes >= groupEnd) flush();
    group.push(block);
    groupEnd = Math.max(groupEnd, block.startMinutes + block.minutes);
  }
  if (group.length > 0) flush();

  return out;
}
