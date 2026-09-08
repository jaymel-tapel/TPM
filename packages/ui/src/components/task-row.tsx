import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Progress } from "../primitives/progress";
import { cn } from "../lib/utils";
import { AvatarStack } from "./user-avatar";
import { DocCount, PriorityLabel, StatusMark, TagBadge, TypeLabel } from "./task-meta";
import { Eyebrow } from "./section";
import { DragSource } from "./task-drag";
import { Percent } from "./stat";
import type { Person, TaskRowData } from "../types";

function Sep() {
  return <span className="text-gray-400">·</span>;
}

/**
 * The atom of the whole product. Shows the type, when it's due, and at most a
 * couple of further properties — never everything a task could carry.
 *
 * The toggle is injected: this package renders the control, the app supplies
 * the server action behind it.
 */
export function TaskRow({
  task,
  viewer,
  onToggle,
  quiet = false,
  onPlan,
  planDay,
  planned = false,
}: {
  task: TaskRowData;
  /** Omit to show who a task belongs to (team and report views). */
  viewer?: Person["id"];
  /** A server action taking a `taskId` field. Omitted renders an inert control. */
  onToggle?: (formData: FormData) => void | Promise<void>;
  /** Completed work sits back visually rather than competing for attention. */
  quiet?: boolean;
  /**
   * Schedules this task into the next free slot. Supplied only where a day
   * plan is on the page; it also turns the row into a drag source, and is the
   * keyboard equivalent of dragging one over.
   */
  onPlan?: (formData: FormData) => void | Promise<void>;
  /** `yyyy-MM-dd` of the day the plan is showing, so Plan puts work where the
   *  reader is looking rather than always into today. */
  planDay?: string;
  /** Already has a place in that day, so the command reads as done. */
  planned?: boolean;
}) {
  const collaborators = task.assignees.filter((a) => a.id !== viewer);
  const shared = task.assignees.length > 1;
  const flagged = !task.done && task.priority !== "normal";

  const control = (
    <button
      type="submit"
      disabled={!onToggle}
      aria-label={task.done ? `Reopen ${task.title}` : `Complete ${task.title}`}
      className="cursor-pointer rounded-full transition-transform active:scale-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default"
    >
      <StatusMark kind={task.status.kind} label={task.status.name} />
    </button>
  );

  const shell = cn(
    "group flex items-start gap-3 px-4 transition-colors hover:bg-gray-100",
    quiet ? "py-2" : "py-3",
    onPlan && "cursor-grab active:cursor-grabbing",
  );

  const body = (
    <>
      <div className="group/check pt-0.5">
        {onToggle ? (
          <form action={onToggle}>
            <input type="hidden" name="taskId" value={task.id} />
            {control}
          </form>
        ) : (
          control
        )}
      </div>

      <Link href={task.href} className="min-w-0 flex-1">
        <div className={cn("text-body-strong", quiet ? "text-gray-600" : "text-gray-1000")}>
          {task.title}
        </div>

        {/* Finished work keeps its title legible but drops the metadata — it is
            a record of what happened, not something to act on. */}
        {quiet ? null : (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-gray-700">
            <TypeLabel type={task.type} />

            {shared ? (
              <>
                <Sep />
                <span className="inline-flex items-center gap-2">
                  <AvatarStack names={collaborators.map((a) => a.name)} size="xs" />
                  Collaborative
                </span>
              </>
            ) : !viewer ? (
              <>
                <Sep />
                <span>{task.assignees[0]?.name ?? "Unassigned"}</span>
              </>
            ) : null}

            {flagged ? (
              <>
                <Sep />
                <PriorityLabel priority={task.priority} />
              </>
            ) : null}

            {task.tags.slice(0, 1).map((tag) => (
              <TagBadge key={tag}>{tag}</TagBadge>
            ))}

            {task.docs > 0 ? (
              <>
                <Sep />
                <DocCount count={task.docs} />
              </>
            ) : null}
          </div>
        )}
      </Link>

      <div
        className={cn(
          "tabular shrink-0 pt-0.5 text-right text-caption",
          task.overdue ? "font-medium text-red-700" : "text-gray-600",
        )}
      >
        {task.done ? null : task.dueText}
      </div>

      {/* Dragging is an enhancement. This is the same move without a mouse. */}
      {onPlan && !task.done ? (
        <form action={onPlan} className="shrink-0 pt-0.5">
          <input type="hidden" name="taskId" value={task.id} />
          {planDay ? <input type="hidden" name="day" value={planDay} /> : null}
          <button
            type="submit"
            disabled={planned}
            aria-label={planned ? `${task.title} is already in your day` : `Plan ${task.title}`}
            title={planned ? "In your day" : "Plan this"}
            className={cn(
              "rounded-md p-1 transition-colors",
              planned
                ? "text-blue-700"
                : "text-gray-600 opacity-0 hover:bg-gray-200 hover:text-gray-1000 focus-visible:opacity-100 group-hover:opacity-100",
            )}
          >
            <CalendarPlus className="size-4" strokeWidth={1.75} />
          </button>
        </form>
      ) : null}
    </>
  );

  /* Only rows that can be planned become a client component, and only the
     wrapper does — see `DragSource`. */
  return onPlan ? (
    <DragSource taskId={task.id} className={shell}>
      {body}
    </DragSource>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/**
 * A titled list of tasks. Border first — one hairline-separated flat surface,
 * no shadow.
 */
export function TaskList({
  title,
  tone = "default",
  children,
}: {
  title?: React.ReactNode;
  tone?: "default" | "danger" | "quiet";
  children: React.ReactNode;
}) {
  const border = {
    default: "border-gray-400",
    danger: "border-red-300",
    quiet: "border-gray-300",
  }[tone];

  return (
    <section>
      {title ? (
        <Eyebrow rule tone={tone === "danger" ? "danger" : "muted"} className="mb-3">
          {title}
        </Eyebrow>
      ) : null}
      <div
        className={cn(
          "divide-y divide-gray-300 overflow-hidden rounded-xl border bg-background-100",
          border,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-400 px-4 py-12 text-center">
      <p className="text-body text-gray-600">{children}</p>
    </div>
  );
}

/** The "nn% · x / y" readout with its bar. Used on every rollup surface. */
export function CompletionMeter({
  done,
  due,
  percent,
  label = "Today",
}: {
  done: number;
  due: number;
  percent: number;
  label?: string;
}) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <p className="tabular mt-3 text-large-title text-gray-1000">
        <Percent value={percent} />
      </p>
      <Progress value={percent} className="mt-4 h-1.5" />
      <p className="tabular mt-3 text-caption text-gray-700">
        {done} / {due} completed
      </p>
    </div>
  );
}
