"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { cn } from "../lib/utils";
import { AvatarStack } from "./user-avatar";
import { StatusMark } from "./task-meta";
import type { SubtaskData } from "../types";

/** How far each level steps in. Four levels still leave a title room to read. */
const INDENT = 20;

/** Finished and total among one level's pieces. */
function tally(nodes: SubtaskData[]) {
  return { done: nodes.filter((n) => n.done).length, total: nodes.length };
}

function Row({
  subtask,
  depth,
  maxDepth,
  onToggle,
  addFor,
  openFor,
  setOpenFor,
}: {
  subtask: SubtaskData;
  depth: number;
  maxDepth: number;
  onToggle?: (formData: FormData) => void | Promise<void>;
  addFor?: (parentId: string) => React.ReactNode;
  openFor: string | null;
  setOpenFor: (id: string | null) => void;
}) {
  const [, start] = useTransition();
  const branch = subtask.children.length > 0;
  const counts = tally(subtask.children);
  const adding = openFor === subtask.id;
  // The floor is a readability limit, and the server enforces the same one —
  // offering a control that would be refused is worse than not offering it.
  const canNest = Boolean(addFor) && depth < maxDepth;

  return (
    <li>
      <div
        className="group/row flex items-start gap-3 py-3 pr-4"
        style={{ paddingLeft: 16 + depth * INDENT }}
      >
        <div className="pt-0.5">
          {branch ? (
            /*
             * A branch has nothing to tick. `toggleTaskDone` refuses it — its
             * pieces are the work — so it reports on them instead of offering
             * a control that would only ever return an error.
             */
            <span
              aria-label={`${counts.done} of ${counts.total} finished`}
              className={cn(
                "tabular inline-flex h-5 min-w-9 items-center justify-center rounded-full px-1.5 text-caption-strong",
                subtask.done ? "bg-green-100 text-green-900" : "bg-gray-200 text-gray-700",
              )}
            >
              {counts.done}/{counts.total}
            </span>
          ) : (
            <button
              type="button"
              disabled={!onToggle}
              aria-label={subtask.done ? `Reopen ${subtask.title}` : `Complete ${subtask.title}`}
              onClick={() => {
                if (!onToggle) return;
                const data = new FormData();
                data.set("taskId", subtask.id);
                start(() => {
                  void onToggle(data);
                });
              }}
              className="cursor-pointer rounded-full transition-transform active:scale-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default"
            >
              <StatusMark
                kind={subtask.done ? "done" : "open"}
                label={subtask.done ? "Done" : "To do"}
              />
            </button>
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

        {canNest ? (
          /*
           * Quiet until the row is wanted. Breaking a piece down further is a
           * thing you occasionally do, not a thing every row should advertise
           * — six of these shouting at once is what makes a tree look like
           * admin.
           */
          <button
            type="button"
            aria-label={adding ? `Stop adding under ${subtask.title}` : `Add a piece under ${subtask.title}`}
            onClick={() => setOpenFor(adding ? null : subtask.id)}
            className={cn(
              "shrink-0 cursor-pointer rounded-md p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-1000 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              !adding && "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
            )}
          >
            {adding ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          </button>
        ) : null}

        <AvatarStack names={subtask.assignees.map((a) => a.name)} size="xs" />

        <span
          className={cn(
            "tabular shrink-0 pt-0.5 text-right text-caption",
            !subtask.done && subtask.overdue ? "font-medium text-red-700" : "text-gray-600",
          )}
        >
          {subtask.dueText}
        </span>
      </div>

      {adding && addFor ? (
        <div className="pt-1 pb-3 pr-4" style={{ paddingLeft: 16 + (depth + 1) * INDENT }}>
          {addFor(subtask.id)}
        </div>
      ) : null}

      {branch ? (
        <ul className="divide-y divide-gray-300 border-t border-gray-300">
          {subtask.children.map((child) => (
            <Row
              key={child.id}
              subtask={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              onToggle={onToggle}
              addFor={addFor}
              openFor={openFor}
              setOpenFor={setOpenFor}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * The pieces a task was broken into, and the pieces of those.
 *
 * Once a task has any of these it stops being work in its own right — the
 * leaves are what the day counts, and everything above them is a container. So
 * this leads with how many are finished: that number *is* the parent's
 * progress, and there is nothing else to report about it. The same holds at
 * every level, which is what makes depth safe: a deeper tree never changes
 * what a day counts, it only says more about how the work is arranged.
 *
 * The whole branch renders at once rather than a level at a time. It arrives in
 * one query, it is small, and a tree you have to open a row at a time to see
 * the shape of is the thing this product is a reaction against.
 *
 * Toggling posts through a click rather than through a form of its own. It has
 * to: unframed this sits inside the task form, and a form inside a form is not
 * markup a browser keeps — the inner tags are dropped on the way through the
 * parser, which would turn "complete this piece" into "save the whole task".
 */
export function SubtaskList({
  subtasks,
  onToggle,
  onAdd,
  addFor,
  framed = true,
  maxDepth = 5,
}: {
  /** The top level. Each carries its own children, however deep. */
  subtasks: SubtaskData[];
  /** Server action taking a `taskId`. Omitted renders inert controls. */
  onToggle?: (formData: FormData) => void | Promise<void>;
  /** The creator for the task this list belongs to, under the list. */
  onAdd?: React.ReactNode;
  /** The same creator bound to a piece further down. Omitted, rows cannot nest. */
  addFor?: (parentId: string) => React.ReactNode;
  /**
   * A panel of its own, or a field among fields. Unframed drops the card so it
   * can sit inside the task form without framing the same content twice.
   */
  framed?: boolean;
  /** How deep a row may still offer to nest. Matches the server's own floor. */
  maxDepth?: number;
}) {
  /** Only one row is ever being added to; two open boxes is two questions. */
  const [openFor, setOpenFor] = useState<string | null>(null);
  const counts = tally(subtasks);

  const rows = subtasks.map((subtask) => (
    <Row
      key={subtask.id}
      subtask={subtask}
      depth={0}
      maxDepth={maxDepth}
      onToggle={onToggle}
      addFor={addFor}
      openFor={openFor}
      setOpenFor={setOpenFor}
    />
  ));

  const count =
    counts.total > 0 ? (
      <span className="tabular ml-auto text-caption text-gray-600">
        {counts.done} / {counts.total}
      </span>
    ) : null;

  if (!framed) {
    return (
      <div>
        {/* Titled like the fields around it, because that is what it now is.
            The count keeps the list's own company rather than the form's. */}
        <div className="mb-2 flex items-center gap-2">
          <span className="text-caption-strong tracking-[0.08em] text-gray-600 uppercase">
            Subtasks
          </span>
          {count}
        </div>

        {counts.total > 0 ? (
          <ul className="divide-y divide-gray-300 rounded-lg border border-gray-400">{rows}</ul>
        ) : null}

        {onAdd ? <div className={cn(counts.total > 0 && "mt-2")}>{onAdd}</div> : null}

        {/* The invitation only while there is nothing to see. Once there are
            pieces, the list has already made the point. */}
        {counts.total === 0 ? (
          <p className="mt-2 text-caption text-gray-600">
            {onAdd
              ? "Break this into pieces and the pieces become the work."
              : "Not broken down."}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-400 bg-background-100">
      <div className="flex items-center gap-2 border-b border-gray-300 px-4 py-3">
        <h2 className="text-body-strong text-gray-1000">Subtasks</h2>
        {count}
      </div>

      {counts.total === 0 ? (
        <p className="px-4 py-6 text-center text-caption text-gray-600">
          {onAdd ? "Break this into pieces and the pieces become the work." : "Not broken down."}
        </p>
      ) : (
        <ul className="divide-y divide-gray-300">{rows}</ul>
      )}

      {onAdd ? <div className="border-t border-gray-300 p-4">{onAdd}</div> : null}
    </div>
  );
}
