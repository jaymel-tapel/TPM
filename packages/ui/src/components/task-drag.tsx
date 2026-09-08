"use client";

import { TASK_DRAG_TYPE } from "../types";

/**
 * The smallest possible client boundary: a row that can be picked up.
 *
 * `TaskRow` stays a server component — it is on nearly every screen, and
 * shipping it and its whole subtree to the browser to add one drag handler
 * would be a poor trade. Only the wrapper crosses.
 *
 * The id goes on the transfer rather than into React state, unlike the board:
 * the drop target is a different component on the other side of the page, so
 * the id has to actually travel with the drag.
 */
export function DragSource({
  taskId,
  className,
  children,
}: {
  taskId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(TASK_DRAG_TYPE, taskId);
        // Some browsers refuse to start a drag with no standard type on it.
        e.dataTransfer.setData("text/plain", taskId);
      }}
      className={className}
    >
      {children}
    </div>
  );
}
