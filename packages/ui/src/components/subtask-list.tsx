import Link from "next/link";
import { cn } from "../lib/utils";
import { AvatarStack } from "./user-avatar";
import { StatusMark } from "./task-meta";
import type { SubtaskData } from "../types";

/**
 * The pieces a task was broken into.
 *
 * Once a task has any of these it stops being work in its own right — the
 * pieces are what the day counts, and the whole is a container. So this panel
 * leads with how many are finished: that number *is* the parent's progress,
 * and there is nothing else to report about it.
 */
export function SubtaskList({
  subtasks,
  onToggle,
  onAdd,
}: {
  subtasks: SubtaskData[];
  /** Server action taking a `taskId`. Omitted renders inert controls. */
  onToggle?: (formData: FormData) => void | Promise<void>;
  /** The inline creator, rendered under the list. */
  onAdd?: React.ReactNode;
}) {
  const done = subtasks.filter((s) => s.done).length;

  return (
    <div className="rounded-xl border border-gray-400 bg-background-100">
      <div className="flex items-center gap-2 border-b border-gray-300 px-4 py-3">
        <h2 className="text-body-strong text-gray-1000">Subtasks</h2>
        {subtasks.length > 0 ? (
          <span className="tabular ml-auto text-caption text-gray-600">
            {done} / {subtasks.length}
          </span>
        ) : null}
      </div>

      {subtasks.length === 0 ? (
        <p className="px-4 py-6 text-center text-caption text-gray-600">
          {onAdd
            ? "Break this into pieces and the pieces become the work."
            : "Not broken down."}
        </p>
      ) : (
        <ul className="divide-y divide-gray-300">
          {subtasks.map((subtask) => {
            const control = (
              <button
                type="submit"
                disabled={!onToggle}
                aria-label={subtask.done ? `Reopen ${subtask.title}` : `Complete ${subtask.title}`}
                className="cursor-pointer rounded-full transition-transform active:scale-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default"
              >
                <StatusMark
                  kind={subtask.done ? "done" : "open"}
                  label={subtask.done ? "Done" : "To do"}
                />
              </button>
            );

            return (
              <li key={subtask.id} className="flex items-start gap-3 px-4 py-3">
                <div className="pt-0.5">
                  {onToggle ? (
                    <form action={onToggle}>
                      <input type="hidden" name="taskId" value={subtask.id} />
                      {control}
                    </form>
                  ) : (
                    control
                  )}
                </div>

                <Link href={subtask.href} className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-body-strong",
                      subtask.done ? "text-gray-600 line-through" : "text-gray-1000",
                    )}
                  >
                    {subtask.title}
                  </span>
                </Link>

                <AvatarStack names={subtask.assignees.map((a) => a.name)} size="xs" />

                <span
                  className={cn(
                    "tabular shrink-0 pt-0.5 text-right text-caption",
                    !subtask.done && subtask.overdue
                      ? "font-medium text-red-700"
                      : "text-gray-600",
                  )}
                >
                  {subtask.dueText}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {onAdd ? <div className="border-t border-gray-300 p-4">{onAdd}</div> : null}
    </div>
  );
}
