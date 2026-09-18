"use client";

import { useState } from "react";
import { TaskBoard, type BoardData } from "@tpm/ui";

/**
 * The board with something to drag.
 *
 * `TaskBoard` takes a server action, and a function cannot cross the
 * server/client boundary — the gallery page is a server component, so the
 * draggable state needs its own client wrapper to supply one. Same reason as
 * `DocRefListDemo` and `ErrorStateDemo`.
 *
 * It reads the FormData back out rather than faking a rearrangement, so this
 * exercises the action's actual contract: rename a field and the gallery
 * visibly stops working.
 */
export function TaskBoardDemo({ board }: { board: BoardData }) {
  const [state, setState] = useState(board);

  return (
    <TaskBoard
      board={state}
      moreHref="#"
      onMove={(data) => {
        const taskId = String(data.get("taskId"));
        const to = String(data.get("statusId"));
        const order = data.getAll("order").map(String);
        setState((current) => ({
          columns: current.columns.map((column) => {
            if (column.id === to) {
              const byId = new Map(
                current.columns.flatMap((c) => c.tasks).map((t) => [t.id, t]),
              );
              return {
                ...column,
                tasks: order.map((id) => byId.get(id)!).filter(Boolean),
              };
            }
            return { ...column, tasks: column.tasks.filter((t) => t.id !== taskId) };
          }),
        }));
      }}
    />
  );
}
