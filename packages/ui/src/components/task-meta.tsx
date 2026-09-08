import {
  Briefcase,
  ClipboardList,
  Eye,
  Palette,
  Settings2,
  Users,
} from "lucide-react";
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
 * A work-item glyph per type, tinted from the scales. An icon is recognisable
 * before it is read, which is what makes a long list scannable; the colour is
 * the same one the dot used, so nothing about the palette changed — only the
 * shape carrying it. The label always stays: six glyphs are six things to
 * learn, and nobody should have to.
 */
const TYPE_ICON: Record<TaskType, { icon: typeof Briefcase; tone: string }> = {
  client_work: { icon: Briefcase, tone: "text-blue-700" },
  review: { icon: Eye, tone: "text-blue-500" },
  creative: { icon: Palette, tone: "text-red-600" },
  meeting: { icon: Users, tone: "text-green-700" },
  internal: { icon: ClipboardList, tone: "text-gray-600" },
  admin: { icon: Settings2, tone: "text-amber-600" },
};

export const TASK_TYPES_ORDER = Object.keys(TYPE_ICON) as TaskType[];

export function TypeIcon({ type, className }: { type: TaskType; className?: string }) {
  const { icon: Icon, tone } = TYPE_ICON[type];
  return (
    <Icon aria-hidden className={cn("size-3.5 shrink-0", tone, className)} strokeWidth={1.75} />
  );
}

export function TypeLabel({ type, className }: { type: TaskType; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <TypeIcon type={type} />
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
    <span className="rounded-md bg-gray-100 px-1.5 text-caption-strong text-gray-700">{children}</span>
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
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-caption font-medium leading-none transition-colors",
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
