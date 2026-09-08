import type { StatusKind } from "@/db/schema";

/**
 * When moving a card changes whether the work is finished — and when it does
 * not.
 *
 * A board's `done` column is its finish line: dropping a card there marks the
 * task complete. Taking it back out does not unmark it, and neither does
 * moving it onward to a later stage.
 *
 * This used to read `kind === "done" ? (current ?? new Date()) : null`, which
 * made completion a property of *where the card sat*. Dragging a card out of
 * Done erased the fact that it was finished on Tuesday, and last week's report
 * changed retroactively. Completion is something that happened; only a person
 * deciding it did not happen takes it back, and that is `toggleTaskDone`.
 *
 * Its own module rather than a helper inside the actions file: everything
 * exported from a `"use server"` file has to be an async server action, so a
 * pure rule kept in there cannot be tested directly.
 */
export function completionOnMove(kind: StatusKind, current: Date | null): Date | null {
  // Already finished: nothing a move can do changes that, in either direction.
  if (current !== null) return current;
  return kind === "done" ? new Date() : null;
}
