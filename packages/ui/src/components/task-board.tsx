"use client";

import { useCallback, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, GripVertical } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  getFirstCollision,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "../lib/utils";
import { DURATION, EASE, useReducedMotion } from "../lib/motion";
import { AvatarStack } from "./user-avatar";
import { DocCount, PriorityBadge, StatusMark, TypeLabel } from "./task-meta";
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

/** A board as a rearrangement sees it: columns of task ids, top first. */
type Columns = Record<string, string[]>;

function columnOf(columns: Columns, id: string): string | undefined {
  if (id in columns) return id;
  return Object.keys(columns).find((key) => columns[key]!.includes(id));
}

function BoardCard({
  task,
  viewer,
  overlay = false,
}: {
  task: TaskRowData;
  viewer?: string;
  /** Lifted under the cursor: the same card, raised off the page. */
  overlay?: boolean;
}) {
  const collaborators = task.assignees.filter((a) => a.id !== viewer);
  const flagged = !task.done && task.priority !== "normal";

  return (
    <div
      className={cn(
        "rounded-lg border border-gray-400 bg-background-100 p-3 transition-colors",
        overlay && "shadow-large cursor-grabbing",
        task.done && "opacity-60",
      )}
    >
      <Link href={task.href} className="block">
        {flagged ? (
          <div className="mb-1.5">
            <PriorityBadge priority={task.priority} />
          </div>
        ) : null}
        <p
          className={cn(
            "flex items-start gap-1.5 text-body-strong",
            task.done ? "text-gray-600" : "text-gray-1000",
          )}
        >
          {/* Completion is the task's own, so the card states it rather than
              implying it by which column the card is sitting in. A board can
              have six stages and finish work at any of them. */}
          {task.done ? (
            <Check
              className="mt-0.5 size-4 shrink-0 text-green-700"
              strokeWidth={2.5}
              aria-label="Completed"
            />
          ) : null}
          <span className={cn(task.done && "line-through")}>{task.title}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-gray-700">
          <TypeLabel type={task.type} />
          <DocCount count={task.docs} />
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
          {/* Always the deadline. It used to read "Done" once a card reached
              the done column, which threw away the one thing the card is there
              to tell you — when the work is wanted. Whether it is finished is
              the tick above. */}
          <span
            className={cn(
              "tabular shrink-0 text-caption",
              task.done
                ? "text-gray-600"
                : task.overdue
                  ? "font-medium text-red-700"
                  : "text-gray-600",
            )}
          >
            {task.dueText}
          </span>
        </div>
      </Link>
    </div>
  );
}

/**
 * The same card, able to be picked up.
 *
 * While it is in the air this element becomes the hole it will drop into — a
 * dashed rectangle of exactly the right height, in exactly the right slot,
 * with the real card in the overlay under the cursor. A separate floating
 * outline would be two things describing one gap, and would lag the cards
 * moving aside by a frame.
 */
function SortableCard({
  task,
  viewer,
  still,
}: {
  task: TaskRowData;
  viewer?: string;
  still: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    transition: still ? null : { duration: DURATION.normal, easing: EASE.standard },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...listeners}
      className={cn(
        "group/card relative cursor-grab rounded-lg active:cursor-grabbing",
        isDragging && "rounded-lg border border-dashed border-blue-700 bg-blue-100",
      )}
    >
      {/* Hollowed out rather than hidden: the slot has to keep the card's
          height, or every card below it jumps as you lift one. */}
      <div className={cn(isDragging && "invisible")}>
        <BoardCard task={task} viewer={viewer} />
      </div>

      {/*
        The keyboard's grip. Only this carries the button role, so the card's
        link is never nested inside a focusable button; the card body carries
        the pointer listeners, so a mouse can still grab anywhere.
      */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Move ${task.title}`}
        className="absolute right-1 top-1 rounded-md p-0.5 text-gray-600 opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 hover:bg-gray-100 hover:text-gray-1000"
      >
        <GripVertical className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function Column({
  column,
  ids,
  byId,
  viewer,
  moreHref,
  dragging,
  still,
}: {
  column: BoardColumnData;
  ids: string[];
  byId: Map<string, TaskRowData>;
  viewer?: string;
  moreHref?: string;
  /** Something is in the air somewhere on the board. */
  dragging: boolean;
  still: boolean;
}) {
  /*
   * A `SortableContext` is not a drop target. Without a droppable of its own
   * an empty column cannot be dropped into at all.
   */
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const shown = ids.slice(0, COLUMN_LIMIT);
  const hidden = ids.length - shown.length;

  return (
    <section>
      <header className="mb-3 flex items-center gap-2 border-b border-gray-400 pb-2">
        <StatusMark kind={column.kind} />
        <h3 className="truncate text-body-strong text-gray-1000">{column.name}</h3>
        <span className="tabular ml-auto text-caption text-gray-600">{ids.length}</span>
      </header>

      {/*
        The column has no surface of its own. A tinted, bordered tray holding
        bordered white cards frames the same content twice; the header rule and
        the gap between columns already say where one column ends. While a card
        is in the air the gap it will drop into says where it is going, so the
        tray stays out of it.
      */}
      <SortableContext id={column.id} items={shown} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-24 flex-col gap-2 rounded-xl p-1">
          {shown.map((id) => {
            const task = byId.get(id);
            return task ? (
              <SortableCard key={id} task={task} viewer={viewer} still={still} />
            ) : null;
          })}

          {ids.length === 0 ? (
            <p
              className={cn(
                "rounded-lg border border-dashed px-3 py-6 text-center text-caption transition-colors",
                isOver
                  ? "border-blue-700 bg-blue-100 text-blue-900"
                  : "border-gray-400 text-gray-600",
              )}
            >
              {isOver ? "Drop here" : "Nothing here"}
            </p>
          ) : null}

          {/*
            Columns are capped rather than scrolled. Done can hold seventy
            cards on a fifteen-person team, and a column with its own scrollbar
            is both ugly and a trap — the count above is the real answer, and
            the list view is where you read all of them.
          */}
          {hidden > 0 ? (
            // A link you can drop on is a link you will follow by accident, so
            // while something is in the air it is only a count.
            moreHref && !dragging ? (
              <Link
                href={moreHref}
                className="rounded-lg px-3 py-2 text-center text-caption text-gray-700 underline-offset-2 hover:underline"
              >
                {hidden} more in the list
              </Link>
            ) : (
              <p className="px-3 py-2 text-center text-caption text-gray-600">{hidden} more</p>
            )
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}

/**
 * A board is a *lens* on the day, not a place work lives. Columns are the
 * board's own statuses — there is no column builder, and none is coming: the
 * brief rules out a custom status builder.
 *
 * Dragging is an enhancement. Every card is a link to the task, where status
 * can be changed with a keyboard, so the board never becomes the only way to
 * move something — and with `onMove` omitted no drag machinery is mounted at
 * all, which is how the gallery renders it.
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
  /**
   * Server action taking `taskId`, `statusId`, and the destination column's
   * card ids as repeated `order` fields, top first. Omitted disables dragging.
   */
  onMove?: (formData: FormData) => void | Promise<void>;
  /** Where a capped column sends you for the rest. */
  moreHref?: string;
}) {
  const still = useReducedMotion();
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  /** The in-flight arrangement. Null except while something is in the air. */
  const [draft, setDraft] = useState<Columns | null>(null);

  const base = useMemo<Columns>(
    () => Object.fromEntries(board.columns.map((c) => [c.id, c.tasks.map((t) => t.id)])),
    [board],
  );
  const byId = useMemo(
    () => new Map(board.columns.flatMap((c) => c.tasks).map((t) => [t.id, t])),
    [board],
  );

  /*
   * Optimistic, unlike the board this replaces, which cleared its drag state
   * before awaiting and let the card snap back to where it came from until the
   * server answered. You placed it somewhere; watching it jump back reads as a
   * bug rather than as latency.
   */
  const [shown, place] = useOptimistic(
    base,
    (current: Columns, move: { taskId: string; to: string; order: string[] }) =>
      Object.fromEntries(
        Object.entries(current).map(([id, ids]) => [
          id,
          id === move.to ? move.order : ids.filter((i) => i !== move.taskId),
        ]),
      ),
  );

  const live = draft ?? shown;

  const sensors = useSensors(
    /*
     * Distance, not delay. Every card body is a link, and a delay makes each
     * one feel stuck before it decides. Six pixels is under a fingertip's
     * wobble and over a mouse's, and the click is swallowed once it is passed.
     */
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch gets press-and-hold, the platform idiom: a distance constraint
    // here would have to fight vertical scrolling to work.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** The last droppable this drag resolved to. See `collide`. */
  const lastOver = useRef<string | null>(null);

  /*
   * The pointer first; rects only when it is over nothing.
   *
   * Splicing a card into another column moves every rect on the board, so a
   * purely rect-based answer changes without the pointer having moved: the
   * source column closes up, the card is suddenly nearest its old home again,
   * `onDragOver` fires back the other way, and the two columns trade the card
   * frame after frame until React gives up with "maximum update depth
   * exceeded". The pointer is the one thing that does not move when the
   * layout does, which is what breaks the loop.
   *
   * `closestCorners` still answers for the gaps between columns, where the
   * pointer is inside nothing at all, and the last answer is held rather than
   * letting a card in flight snap back to where it came from.
   */
  const collide = useCallback<CollisionDetection>((args) => {
    const hits = pointerWithin(args);
    const id = getFirstCollision(hits.length > 0 ? hits : closestCorners(args), "id");
    if (id != null) {
      lastOver.current = String(id);
      return [{ id }];
    }
    return lastOver.current ? [{ id: lastOver.current }] : [];
  }, []);

  function submit(taskId: string, to: string, order: string[]) {
    if (!onMove) return;
    const data = new FormData();
    data.set("taskId", taskId);
    data.set("statusId", to);
    for (const id of order.slice(0, COLUMN_LIMIT)) data.append("order", id);
    startTransition(() => {
      place({ taskId, to, order });
      void onMove(data);
    });
  }

  function handleDragStart(event: DragStartEvent) {
    lastOver.current = null;
    setActiveId(String(event.active.id));
    setDraft(shown);
  }

  /*
   * Between columns only. Reordering inside one is `onDragEnd`'s job: this
   * fires continuously, and splicing on every frame re-measures the rects
   * under a pointer that has not moved, which shows up as flicker.
   */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !draft) return;
    const from = columnOf(draft, String(active.id));
    const to = columnOf(draft, String(over.id));
    if (!from || !to || from === to) return;

    setDraft((columns) => {
      if (!columns) return columns;
      const target = columns[to] ?? [];
      const overIndex = target.indexOf(String(over.id));
      const below =
        overIndex >= 0 &&
        Boolean(active.rect.current.translated) &&
        active.rect.current.translated!.top > over.rect.top + over.rect.height / 2;
      const at = overIndex < 0 ? target.length : overIndex + (below ? 1 : 0);
      return {
        ...columns,
        [from]: (columns[from] ?? []).filter((id) => id !== String(active.id)),
        [to]: [...target.slice(0, at), String(active.id), ...target.slice(at)],
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const columns = draft;
    lastOver.current = null;
    setActiveId(null);
    setDraft(null);
    if (!columns || !over || !onMove) return;

    const to = columnOf(columns, String(over.id));
    if (!to) return;
    const ids = columns[to] ?? [];
    const oldIndex = ids.indexOf(String(active.id));
    const overIndex = ids.indexOf(String(over.id));
    const order =
      overIndex < 0 || oldIndex === overIndex ? ids : arrayMove(ids, oldIndex, overIndex);

    // Put back exactly where it was. Not a write.
    if (order.join() === (shown[to] ?? []).join()) return;
    submit(String(active.id), to, order);
  }

  /* Escape puts the board back. The old implementation could not: it cleared
     its drag state before awaiting, so cancelled and pending looked alike. */
  function handleDragCancel() {
    lastOver.current = null;
    setActiveId(null);
    setDraft(null);
  }

  // No action, no drag machinery: a read-only board should not ship the
  // engine's listeners or its live region.
  if (!onMove) {
    return (
      <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-4">
        {board.columns.map((column) => (
          <ReadOnlyColumn
            key={column.id}
            column={column}
            viewer={viewer}
            moreHref={moreHref}
          />
        ))}
      </div>
    );
  }

  const grid = (
    <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-4">
      {board.columns.map((column) => (
        <Column
          key={column.id}
          column={column}
          ids={live[column.id] ?? []}
          byId={byId}
          viewer={viewer}
          moreHref={moreHref}
          dragging={activeId !== null}
          still={still}
        />
      ))}
    </div>
  );

  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext
      /*
       * A fixed id, or the screen-reader description dnd-kit renders is
       * numbered from a module-level counter that has counted a different
       * number of times on the server than in the browser — which React sees
       * as a hydration mismatch on every card.
       */
      id="task-board"
      sensors={sensors}
      collisionDetection={collide}
      /* Splicing a card into another column changes the layout under the
         pointer; stale droppable rects are what that looks like when this is
         left at its default. */
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {grid}
      <DragOverlay dropAnimation={still ? null : DROP_ANIMATION}>
        {active ? <BoardCard task={active} viewer={viewer} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

const DROP_ANIMATION: DropAnimation = {
  duration: DURATION.normal,
  // It lands rather than arrives: fast away from the cursor, settling in.
  easing: EASE.decelerate,
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
};

/** The board with nothing to drag: the same columns, plain. */
function ReadOnlyColumn({
  column,
  viewer,
  moreHref,
}: {
  column: BoardColumnData;
  viewer?: string;
  moreHref?: string;
}) {
  const shown = column.tasks.slice(0, COLUMN_LIMIT);
  const hidden = column.tasks.length - shown.length;

  return (
    <section>
      <header className="mb-3 flex items-center gap-2 border-b border-gray-400 pb-2">
        <StatusMark kind={column.kind} />
        <h3 className="truncate text-body-strong text-gray-1000">{column.name}</h3>
        <span className="tabular ml-auto text-caption text-gray-600">
          {column.tasks.length}
        </span>
      </header>
      <div className="flex min-h-24 flex-col gap-2 rounded-xl p-1">
        {shown.map((task) => (
          <BoardCard key={task.id} task={task} viewer={viewer} />
        ))}
        {column.tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-400 px-3 py-6 text-center text-caption text-gray-600">
            Nothing here
          </p>
        ) : null}
        {hidden > 0 ? (
          moreHref ? (
            <Link
              href={moreHref}
              className="rounded-lg px-3 py-2 text-center text-caption text-gray-700 underline-offset-2 hover:underline"
            >
              {hidden} more in the list
            </Link>
          ) : (
            <p className="px-3 py-2 text-center text-caption text-gray-600">{hidden} more</p>
          )
        ) : null}
      </div>
    </section>
  );
}
