import { cn } from "../lib/utils";

/**
 * The shape of somebody's day: what is done, what slipped, and what is left.
 *
 * Only two things are drawn. Remaining work is the *gap* — the track showing
 * through — because that is what the unfilled part of a progress bar has
 * always meant, and colouring it in said the same thing twice. It still takes
 * up its share of the width, so the proportions are honest; it just is not
 * painted.
 *
 * Green and red report state, which `DESIGN.md` allows them and only them.
 * They sit together at the head of the bar so the painted run is contiguous —
 * a red segment floating past a grey gap reads as a rendering fault rather
 * than as a fact.
 *
 * One consequence worth knowing: a person with nothing due and a person whose
 * whole day is still ahead of them both draw an empty track. The note beside
 * the bar is what separates them, saying "Nothing due today" or "5 remaining".
 */
export function WorkBar({
  done,
  remaining,
  overdue,
  muted = false,
  className,
}: {
  done: number;
  remaining: number;
  overdue: number;
  /**
   * Quieter, for a day somebody was away — the same reason the row dims their
   * percentage. The numbers are still true; they are just not a fact about
   * that person.
   */
  muted?: boolean;
  className?: string;
}) {
  const total = done + remaining + overdue;

  // `300` is the muted-background step, and it is both the empty state and the
  // colour of whatever is still to do.
  const track = cn("flex h-1.5 overflow-hidden rounded-full bg-gray-300", className);

  if (total === 0) return <div className={track} />;

  const segments = [
    { count: done, tone: muted ? "bg-green-300" : "bg-green-700", word: "done" },
    { count: overdue, tone: muted ? "bg-red-300" : "bg-red-700", word: "overdue" },
    // Painted with nothing, so the track shows through. It still has to be
    // rendered: `flex-grow` shares out the free space between the children
    // that have it, so without this the two painted runs would stretch to fill
    // the whole bar and every day would read as finished.
    { count: remaining, tone: "", word: "remaining" },
  ];

  return (
    <div
      role="img"
      aria-label={segments
        .filter((s) => s.count > 0)
        .map((s) => `${s.count} ${s.word}`)
        .join(", ")}
      className={track}
    >
      {segments.map((s) =>
        s.count > 0 ? (
          <div key={s.word} className={s.tone} style={{ flexGrow: s.count }} />
        ) : null,
      )}
    </div>
  );
}
