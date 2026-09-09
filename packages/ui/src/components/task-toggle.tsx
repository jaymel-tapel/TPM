"use client";

import { usePathname } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { StatusMark } from "./task-meta";
import type { StatusKind } from "../types";

/**
 * The completion mark, flipped before the server has heard about it.
 *
 * This is the most-pressed control in the product and it used to be a bare
 * `<form action={…}>`: the click submitted, the action wrote the row, the whole
 * layout revalidated, and only then did the tick appear. Every round trip in
 * that chain was visible as a dead moment on a control that should feel like a
 * checkbox.
 *
 * `useOptimistic` flips the mark immediately and React reverts it if the
 * action fails — which is the honest behaviour, because a failed write should
 * not leave a task looking done. The board's drag-and-drop has worked this way
 * since it shipped; this is the same pattern on the smaller control.
 *
 * It is a client component so that `TaskRow` does not have to be. A row is
 * mostly text and links, and shipping all of that to the browser to make one
 * button interactive would be the wrong trade.
 */
export function TaskToggle({
  taskId,
  title,
  done,
  kind,
  label,
  onToggle,
}: {
  taskId: string;
  /** For the accessible name — "Complete Send the report". */
  title: string;
  done: boolean;
  kind: StatusKind;
  /** The column's own name, whatever its owner called it. */
  label?: string;
  onToggle?: (formData: FormData) => void | Promise<void>;
}) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [, startTransition] = useTransition();
  /*
   * The page this row is on, sent with the write so the action can revalidate
   * just this route instead of the whole application. Completing a task does
   * not change the rail, and re-running the rail's queries for it was work
   * nobody asked for.
   */
  const pathname = usePathname();

  /*
   * While a toggle is in flight the mark shows plain done/open rather than the
   * column's own kind: a task moving out of a blocked column is not blocked
   * any more, and holding the blocked styling until the server answers would
   * be showing the state we are leaving.
   */
  const shown: StatusKind = optimisticDone === done ? kind : optimisticDone ? "done" : "open";

  if (!onToggle) {
    return <StatusMark kind={shown} label={label} className="opacity-100" />;
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          setOptimisticDone(!done);
          await onToggle(formData);
        });
      }}
    >
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="path" value={pathname} />
      <button
        type="submit"
        aria-label={done ? `Reopen ${title}` : `Complete ${title}`}
        className="cursor-pointer rounded-full transition-transform active:scale-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <StatusMark kind={shown} label={label} />
      </button>
    </form>
  );
}
