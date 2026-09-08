import {
  Briefcase,
  ChevronUp,
  ChevronsUp,
  ClipboardList,
  Eye,
  FileText,
  Palette,
  Settings2,
  Users,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  PRIORITY_LABELS,
  STATUS_KIND_LABELS,
  TASK_TYPE_LABELS,
  type Priority,
  type StatusKind,
  type StatusRef,
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

/*
 * Priority is only ever shown when it is not "normal", and it stays inside the
 * red scale. Amber is spoken for — DESIGN.md reserves it for the single most
 * important number on a screen — so urgency separates by weight rather than by
 * hue: urgent is filled, high is outlined, and the arrow count does the rest.
 */
const PRIORITY_ICON: Record<Exclude<Priority, "normal">, typeof ChevronUp> = {
  high: ChevronUp,
  urgent: ChevronsUp,
};

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  if (priority === "normal") return null;
  const Icon = PRIORITY_ICON[priority];
  return <Icon aria-hidden className={cn("size-3.5 shrink-0", className)} strokeWidth={2.25} />;
}

/** Inline form, for a dense row where a chip would be too loud. */
export function PriorityLabel({ priority }: { priority: Priority }) {
  if (priority === "normal") return null;
  return (
    <span className="inline-flex items-center gap-1 font-medium text-red-700">
      <PriorityIcon priority={priority} />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

/**
 * Chip form, for above a card title. It sits over the title rather than under
 * it because urgency is the thing you want to have registered before you read
 * what the work is.
 */
export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "normal") return null;
  const filled = priority === "urgent";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-caption-strong",
        filled
          ? "bg-red-700 text-white"
          : "border border-red-300 bg-red-100 text-red-900",
      )}
    >
      <PriorityIcon priority={priority} />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function TagBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-gray-100 px-1.5 text-caption-strong text-gray-700">{children}</span>
  );
}

/**
 * How many documents this task points at. A count rather than the names: the
 * names are on the task, and a row is a place to notice that there is standing
 * guidance here, not to read it.
 */
export function DocCount({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-caption text-gray-700"
      title={`${count} referenced ${count === 1 ? "document" : "documents"}`}
    >
      <FileText className="size-3" strokeWidth={1.75} />
      {count}
    </span>
  );
}

/*
 * Keyed by kind, because a board may call its columns anything. Three marks
 * rather than four: "started" was never a distinct state to the system, only a
 * distinct column, and the system does not get to guess which of a board's
 * open columns means in-progress.
 */
const STATUS_STYLES: Record<StatusKind, string> = {
  open: "border-gray-500 text-transparent group-hover/check:border-blue-700 group-hover/check:text-blue-300",
  done: "border-green-700 bg-green-700 text-white",
  blocked: "border-red-700 bg-red-100 text-red-700",
};

const MARK: Record<StatusKind, string> = {
  open: "✓",
  done: "✓",
  blocked: "!",
};

/**
 * State reads without colour: the glyph carries the meaning, colour only
 * reinforces it. An unchecked circle ghosts the tick in on hover, so the click
 * target explains itself.
 */
export function StatusMark({
  kind,
  label,
  className,
}: {
  kind: StatusKind;
  /** The column's own name, when there is one to announce. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      aria-label={label ?? STATUS_KIND_LABELS[kind]}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-caption font-medium leading-none transition-colors",
        STATUS_STYLES[kind],
        className,
      )}
    >
      {MARK[kind]}
    </span>
  );
}

/** The same marker with its label, for the task detail status picker. */
export function StatusBadge({ status }: { status: StatusRef }) {
  return (
    <span className="inline-flex items-center gap-2">
      <StatusMark kind={status.kind} label={status.name} />
      {status.name}
    </span>
  );
}
