import { cn } from "../lib/utils";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_TYPE_LABELS,
  type Priority,
  type TaskStatus,
  type TaskType,
} from "../types";

/**
 * Task types are told apart by a dot drawn from the scales, not by a filled
 * badge — a list of tasks should never turn into a colour chart.
 */
const TYPE_DOT: Record<TaskType, string> = {
  client_work: "bg-blue-700",
  review: "bg-blue-400",
  creative: "bg-red-500",
  meeting: "bg-green-600",
  internal: "bg-gray-500",
  admin: "bg-amber-500",
};

export const TASK_TYPES_ORDER = Object.keys(TYPE_DOT) as TaskType[];

export function TypeLabel({ type, className }: { type: TaskType; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TYPE_DOT[type])} />
      {TASK_TYPE_LABELS[type]}
    </span>
  );
}

/** Priority is only ever shown when it is not "normal". */
export function PriorityLabel({ priority }: { priority: Priority }) {
  if (priority === "normal") return null;
  return <span className="font-medium text-red-700">{PRIORITY_LABELS[priority]}</span>;
}

export function TagBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-6 bg-gray-100 px-1.5 text-label-12 text-gray-700">{children}</span>
  );
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: "border-gray-500 text-transparent group-hover/check:border-blue-700 group-hover/check:text-blue-300",
  in_progress: "border-blue-700 text-blue-700",
  done: "border-green-700 bg-green-700 text-white",
  blocked: "border-red-700 bg-red-100 text-red-700",
};

const MARK: Record<TaskStatus, string> = {
  todo: "✓",
  in_progress: "◐",
  done: "✓",
  blocked: "!",
};

/**
 * State reads without colour: the glyph carries the meaning, colour only
 * reinforces it. An unchecked circle ghosts the tick in on hover, so the click
 * target explains itself.
 */
export function StatusMark({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span
      aria-label={STATUS_LABELS[status]}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-copy-13 font-medium leading-none transition-colors",
        STATUS_STYLES[status],
        className,
      )}
    >
      {MARK[status]}
    </span>
  );
}

/** The same marker with its label, for the task detail status picker. */
export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className="inline-flex items-center gap-2">
      <StatusMark status={status} />
      {STATUS_LABELS[status]}
    </span>
  );
}
