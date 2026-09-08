"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "../lib/utils";
import { AvatarStack } from "./user-avatar";
import { PriorityLabel, StatusMark, TypeLabel } from "./task-meta";
import { type StatusKind, type TaskRowData } from "../types";

/** Cards shown per column before deferring to the list. See the note below. */
const COLUMN_LIMIT = 12;

export type BoardColumnData = {
  id: string;
  name: string;
  kind: StatusKind;
  tasks: TaskRowData[];
};

/** Columns arrive in the order the board's owner arranged them. */
export type BoardData = { columns: BoardColumnData[] };

function BoardCard({
  task,
  viewer,
  draggable,
  onDragStart,
}: {
  task: TaskRowData;
  viewer?: string;
  draggable: boolean;
  onDragStart: (id: string) => void;
}) {
  const collaborators = task.assignees.filter((a) => a.id !== viewer);
  const flagged = !task.done && task.priority !== "normal";

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Some browsers will not start a drag without data on the transfer.
        e.dataTransfer.setData("text/plain", task.id);
        onDragStart(task.id);
      }}
      className={cn(
        "rounded-lg border border-gray-400 bg-background-100 p-3 transition-colors",
        draggable && "cursor-grab active:cursor-grabbing",
        task.done && "opacity-60",
      )}
    >
      <Link href={task.href} className="block">
        <p
          className={cn(
            "text-body-strong",
            task.done ? "text-gray-600" : "text-gray-1000",
          )}
        >
          {task.title}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-gray-700">
          <TypeLabel type={task.type} />
          {flagged ? <PriorityLabel priority={task.priority} /> : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          {/*
            Who owns a card is a glance, not a read. On a personal board
            `collaborators` is empty for solo work, so the card stays quiet
            about the obvious — it is yours.
          */}
          <AvatarStack
            names={collaborators.map((a) => a.name)}
            size="sm"
            title={collaborators.map((a) => a.name).join(", ")}
          />
          <span
            className={cn(
              "tabular shrink-0 text-caption",
              task.overdue ? "font-medium text-red-700" : "text-gray-600",
            )}
          >
            {task.done ? "Done" : task.dueText}
          </span>
        </div>
      </Link>
    </div>
  );
}

/**
 * A board is a *lens* on the day, not a place work lives. Columns are the four
 * fixed statuses — there is no column builder, and none is coming: the brief
 * rules out a custom status builder.
 *
 * Dragging is an enhancement. Every card is a link to the task, where status
 * can be changed with a keyboard, so the board never becomes the only way to
 * move something.
 */
export function TaskBoard({
  board,
  viewer,
  onMove,
  moreHref,
}: {
  board: BoardData;
  /** Omit to show who each task belongs to (team boards). */
  viewer?: string;
  /** Server action taking `taskId` and `status`. Omitted disables dragging. */
  onMove?: (formData: FormData) => void | Promise<void>;
  /** Where a capped column sends you for the rest. */
  moreHref?: string;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  async function drop(statusId: string) {
    const id = dragging;
    setDragging(null);
    setOver(null);
    if (!id || !onMove) return;

    const data = new FormData();
    data.set("taskId", id);
    data.set("statusId", statusId);
    await onMove(data);
  }

  return (
    <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-4">
      {board.columns.map((column) => {
        const { tasks } = column;
        const shown = tasks.slice(0, COLUMN_LIMIT);
        const hidden = tasks.length - shown.length;
        return (
          <section
            key={column.id}
            onDragOver={(e) => {
              if (!onMove || !dragging) return;
              e.preventDefault();
              setOver(column.id);
            }}
            onDragLeave={() => setOver((s) => (s === column.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              void drop(column.id);
            }}
          >
            <header className="mb-3 flex items-center gap-2 border-b border-gray-400 pb-2">
              <StatusMark kind={column.kind} />
              <h3 className="truncate text-body-strong text-gray-1000">{column.name}</h3>
              <span className="tabular ml-auto text-caption text-gray-600">
                {tasks.length}
              </span>
            </header>

            {/*
              The column has no surface of its own. A tinted, bordered tray
              holding bordered white cards frames the same content twice; the
              header rule and the gap between columns already say where one
              column ends. The tray appears only while something is being
              dragged, which is the one moment it carries information.
            */}
            <div
              className={cn(
                "flex flex-col gap-2 rounded-xl border border-dashed p-1 transition-colors",
                over === column.id
                  ? "border-blue-700 bg-blue-100"
                  : "border-transparent",
              )}
            >
              {shown.map((task) => (
                <BoardCard
                  key={task.id}
                  task={task}
                  viewer={viewer}
                  draggable={Boolean(onMove)}
                  onDragStart={setDragging}
                />
              ))}

              {tasks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-400 px-3 py-6 text-center text-caption text-gray-600">
                  Nothing here
                </p>
              ) : null}

              {/*
                Columns are capped rather than scrolled. Done can hold seventy
                cards on a fifteen-person team, and a column with its own
                scrollbar is both ugly and a trap — the count above is the real
                answer, and the list view is where you read all of them.
              */}
              {hidden > 0 ? (
                moreHref ? (
                  <Link
                    href={moreHref}
                    className="rounded-lg px-3 py-2 text-center text-caption text-gray-700 underline-offset-2 hover:underline"
                  >
                    {hidden} more in the list
                  </Link>
                ) : (
                  <p className="px-3 py-2 text-center text-caption text-gray-600">
                    {hidden} more
                  </p>
                )
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
