"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "../lib/utils";
import { TypeLabel } from "./task-meta";
import { Eyebrow } from "./section";
import { TASK_DRAG_TYPE, type PlanBlockData } from "../types";
import { layoutBlocks, type Positioned } from "../lib/day-layout";

const SLOT_MINUTES = 15;
const MINUTES_PER_HOUR = 60;
/** On the 4pt grid: an hour is 64px, so a quarter hour is 16px — one line of
 *  `text-caption`, which is the least a block can usefully say. */
const HOUR_HEIGHT = 64;
const PX_PER_MINUTE = HOUR_HEIGHT / MINUTES_PER_HOUR;

/**
 * The day, as hours you can drop work into.
 *
 * The page already says what is *due*. This says when you mean to do it, which
 * is a different question and the one a morning actually turns on.
 *
 * Dropping is an enhancement, exactly as it is on the board: `onPlan` omitted
 * renders the grid read-only, and the list beside it carries a Plan command for
 * anyone not using a mouse. The grid is never the only way to place something.
 */
export function DayPlan({
  blocks,
  startHour,
  endHour,
  nowMinutes,
  dayStartIso,
  hourLabels,
  onPlan,
  onUnplan,
}: {
  blocks: PlanBlockData[];
  startHour: number;
  endHour: number;
  /** Minutes from midnight, or null when the plan is not for today. */
  nowMinutes: number | null;
  /**
   * The instant this day starts, as ISO. Supplied rather than derived: the app
   * reasons in one fixed timezone, and a viewer whose laptop is set to another
   * would otherwise compute a midnight several hours off and drop work onto the
   * wrong hour — or the wrong day.
   */
  dayStartIso: string;
  /**
   * Minutes-from-midnight → "9 AM". Data rather than a formatter, so a server
   * component can render this grid: a function prop cannot cross that seam.
   * The app owns the clock either way.
   */
  hourLabels: Record<number, string>;
  /** Takes `taskId`, `startsAt` (ISO) and `minutes`. Omitted disables dropping. */
  onPlan?: (formData: FormData) => void | Promise<void>;
  onUnplan?: (formData: FormData) => void | Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [over, setOver] = useState<number | null>(null);
  const column = useRef<HTMLDivElement>(null);

  /*
   * Optimistic, unlike the board, which clears its drag state before awaiting
   * and lets the card snap back until the server answers. On a grid you are
   * placing something at a spot you chose, and watching it jump back reads as a
   * bug rather than as latency.
   */
  const [shown, place] = useOptimistic(
    blocks,
    (current: PlanBlockData[], move: { taskId: string; startMinutes: number }) => {
      const existing = current.find((b) => b.taskId === move.taskId);
      if (!existing) return current;
      return current.map((b) =>
        b.taskId === move.taskId ? { ...b, startMinutes: move.startMinutes } : b,
      );
    },
  );

  const top = startHour * MINUTES_PER_HOUR;
  const height = (endHour - startHour) * HOUR_HEIGHT;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const offset = (minutes: number) => (minutes - top) * PX_PER_MINUTE;

  /** Which slot the pointer is over, in minutes from midnight. */
  function slotAt(clientY: number): number | null {
    const box = column.current?.getBoundingClientRect();
    if (!box) return null;
    const minutes = top + (clientY - box.top) / PX_PER_MINUTE;
    /*
     * Rounded to the minute before the slot is chosen. A block occupies the
     * band below its line, so flooring is right — but the pixel maths lands a
     * fraction under a whole minute, and flooring that put a drop aimed at the
     * two o'clock line into quarter to two instead.
     */
    const snapped = Math.floor(Math.round(minutes) / SLOT_MINUTES) * SLOT_MINUTES;
    return Math.max(top, Math.min(endHour * MINUTES_PER_HOUR - SLOT_MINUTES, snapped));
  }

  function drop(event: React.DragEvent) {
    event.preventDefault();
    setOver(null);
    if (!onPlan) return;

    /*
     * Read from the transfer, not from component state. The board can keep the
     * dragged id in a `useState` because its source and target are the same
     * component; here the source is a row in the list beside this one, so the
     * id has to actually travel.
     */
    const taskId =
      event.dataTransfer.getData(TASK_DRAG_TYPE) || event.dataTransfer.getData("text/plain");
    const at = slotAt(event.clientY);
    if (!taskId || at === null) return;

    const data = new FormData();
    data.set("taskId", taskId);
    data.set("startsAt", isoFor(at));
    startTransition(() => {
      place({ taskId, startMinutes: at });
      void onPlan(data);
    });
  }

  /** The dropped slot as an instant, on the day the grid is showing. */
  function isoFor(minutes: number): string {
    return new Date(new Date(dayStartIso).getTime() + minutes * 60_000).toISOString();
  }

  const positioned = layoutBlocks(shown);

  return (
    <section aria-label="Your day">
      <Eyebrow rule>Your day</Eyebrow>

      <div
        className={cn(
          "overflow-hidden rounded-xl border border-gray-400 bg-background-100",
          pending && "opacity-90",
        )}
      >
        {/* Nine hours visible; the rest scrolls. Derived from the hour so the
            two can never drift apart. */}
        <div className="overflow-y-auto" style={{ maxHeight: HOUR_HEIGHT * 9 }}>
          <div className="relative flex pt-2">
            {/* The hour gutter. Labels sit on the rule they name. */}
            <div className="w-14 shrink-0 border-r border-gray-300">
              {hours.map((h) => (
                <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
                  <span className="tabular absolute -top-2 right-2 text-caption text-gray-600">
                    {hourLabels[h * MINUTES_PER_HOUR] ?? ""}
                  </span>
                </div>
              ))}
            </div>

            <div
              ref={column}
              className="relative min-w-0 flex-1"
              style={{ height }}
              onDragOver={(event) => {
                if (!onPlan || !event.dataTransfer.types.includes(TASK_DRAG_TYPE)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setOver(slotAt(event.clientY));
              }}
              onDragLeave={() => setOver(null)}
              onDrop={drop}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-gray-300"
                  style={{ top: offset(h * MINUTES_PER_HOUR), height: HOUR_HEIGHT }}
                />
              ))}

              {over !== null ? (
                <div
                  aria-hidden
                  className="absolute inset-x-1 rounded-md border border-dashed border-blue-700 bg-blue-100"
                  style={{ top: offset(over), height: SLOT_MINUTES * PX_PER_MINUTE * 2 }}
                />
              ) : null}

              {nowMinutes !== null && nowMinutes >= top && nowMinutes <= endHour * MINUTES_PER_HOUR ? (
                <div
                  aria-hidden
                  className="absolute inset-x-0 z-10 border-t border-red-600"
                  style={{ top: offset(nowMinutes) }}
                >
                  <span className="absolute -top-1 left-0 size-2 rounded-full bg-red-600" />
                </div>
              ) : null}

              {positioned.map((block) => (
                <Block
                  key={block.taskId}
                  block={block}
                  top={offset(block.startMinutes)}
                  onUnplan={onUnplan}
                />
              ))}
            </div>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="border-t border-gray-300 px-4 py-3 text-center text-caption text-gray-600">
            {onPlan ? "Drag a task here to plan when you'll do it." : "Nothing planned."}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Block({
  block,
  top,
  onUnplan,
}: {
  block: Positioned<PlanBlockData>;
  top: number;
  onUnplan?: (formData: FormData) => void | Promise<void>;
}) {
  // Below about half an hour there is only room for the title.
  const roomy = block.minutes >= 45;

  return (
    <div
      className="group/block absolute px-1"
      style={{
        top,
        height: block.minutes * PX_PER_MINUTE,
        left: `${block.left * 100}%`,
        width: `${block.width * 100}%`,
      }}
    >
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-md border px-2 py-1",
          block.done
            ? "border-gray-400 bg-gray-200 text-gray-600"
            : "border-blue-500 bg-blue-100 text-gray-1000",
        )}
      >
        <Link href={block.href} className="min-w-0">
          <span
            className={cn(
              "block truncate text-caption-strong",
              block.done && "line-through",
            )}
          >
            {block.title}
          </span>
          {roomy ? (
            <span className="mt-0.5 flex items-center gap-2 text-caption text-gray-700">
              <span className="tabular">{block.timeText}</span>
              <TypeLabel type={block.type} />
            </span>
          ) : null}
        </Link>

        {onUnplan ? (
          <form action={onUnplan} className="absolute right-1 top-1">
            <input type="hidden" name="taskId" value={block.taskId} />
            <button
              type="submit"
              aria-label={`Take ${block.title} out of your day`}
              className="rounded-sm p-0.5 text-gray-600 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-1000 focus-visible:opacity-100 group-hover/block:opacity-100"
            >
              <X className="size-3" strokeWidth={2} />
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
