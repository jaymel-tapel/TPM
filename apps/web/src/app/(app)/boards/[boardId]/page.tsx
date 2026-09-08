import Link from "next/link";
import { notFound } from "next/navigation";
import { Columns3, Flag, List, Plus, Settings2, Shapes, Tag, User } from "lucide-react";
import {
  Command,
  CommandBar,
  CommandDivider,
  EmptyState,
  FilterMenu,
  PriorityIcon,
  PRIORITY_LABELS,
  TagBadge,
  TaskBoard,
  TaskList,
  TaskRow,
  TASK_TYPES_ORDER,
  TASK_TYPE_LABELS,
  TypeLabel,
  type FilterOption,
  type Priority,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";

import { canViewTeamWork, isDirector, isSenior } from "@/lib/permissions";
import { getBoard } from "@/queries/boards";
import { getBoardView, listBoardTags } from "@/queries/tasks";
import { toBoard, toTaskRow } from "@/lib/present";
import { moveTask, setTaskStatus, toggleTaskDone } from "@/actions/tasks";

/**
 * Everything the URL says about how to read this board. One object, because
 * five controls each have to preserve the other four and doing that by hand
 * five times is how a filter quietly starts dropping the view you were on.
 */
type BoardQuery = {
  list: boolean;
  mine: boolean;
  type?: string;
  priority?: string;
  tag?: string;
};

/** A search param can arrive repeated. The first one is the answer. */
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) || undefined;

export const dynamic = "force-dynamic";

/**
 * A board is a working surface, so the page is the board and nothing else —
 * no date, no team name, no rollup. Those answer "where am I" and "how are we
 * doing", which the rail and the team screen already answer, and neither is a
 * question anyone has while moving cards.
 */
export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { boardId } = await params;
  const query = await searchParams;
  const { user, zone } = await requireSession();

  const current: BoardQuery = {
    list: query.view === "list",
    mine: query.mine === "1",
    type: one(query.type),
    priority: one(query.priority),
    tag: one(query.tag),
  };
  const asList = current.list;
  const mineOnly = current.mine;
  const filters = { type: current.type, priority: current.priority, tag: current.tag };
  const narrowed = mineOnly || Boolean(current.type || current.priority || current.tag);

  const board = await getBoard(boardId);
  if (!board || !canViewTeamWork(user, board.teamId)) notFound();

  const [view, boardTags] = await Promise.all([
    getBoardView(boardId, undefined, mineOnly ? user.id : null, zone, filters),
    listBoardTags(boardId),
  ]);
  if (!view) notFound();

  /** Keeps every setting you are not currently changing. */
  const href = (change: Partial<BoardQuery> = {}) => {
    const next = { ...current, ...change };
    const params = new URLSearchParams();
    if (next.list) params.set("view", "list");
    if (next.mine) params.set("mine", "1");
    if (next.type) params.set("type", next.type);
    if (next.priority) params.set("priority", next.priority);
    if (next.tag) params.set("tag", next.tag);
    const query = params.toString();
    return `/boards/${boardId}${query ? `?${query}` : ""}`;
  };

  /** Back to the whole board, keeping only which of the two views you are on. */
  const unfiltered = href({ mine: false, type: undefined, priority: undefined, tag: undefined });

  const typeOptions: FilterOption[] = TASK_TYPES_ORDER.map((type) => ({
    value: type,
    label: <TypeLabel type={type} />,
    short: TASK_TYPE_LABELS[type],
    href: href({ type }),
  }));

  const priorityOptions: FilterOption[] = (["urgent", "high"] as Priority[]).map(
    (priority) => ({
      value: priority,
      label: (
        <span className="inline-flex items-center gap-1.5">
          <PriorityIcon priority={priority} className="text-red-700" />
          {PRIORITY_LABELS[priority]}
        </span>
      ),
      short: PRIORITY_LABELS[priority],
      href: href({ priority }),
    }),
  );

  const tagOptions: FilterOption[] = boardTags.map((tag) => ({
    value: tag,
    label: <TagBadge>{tag}</TagBadge>,
    short: tag,
    href: href({ tag }),
  }));

  return (
    <>
      <CommandBar className="sticky top-0 z-20 -mx-8 mb-6 border-b border-gray-300 bg-background px-8 py-3">
        <span className="mr-2 text-subtitle-2 text-gray-1000">{board.name}</span>
        {/* Only for the Senior Director, who is the one person who reaches
            boards across both teams and cannot tell them apart by context. */}
        {isSenior(user) ? (
          <span className="mr-2 text-caption text-gray-600">{board.teamName}</span>
        ) : null}
        <CommandDivider />
        {/*
          Columns or a list — of the same board. The switch means something
          again now that a board is a place: before, "list" and "board" were
          two lenses on a whole team's day and the pairing was arbitrary. The
          list keeps the board's own columns as its headings, so the vocabulary
          an Account Director chose survives the switch.
        */}
        <Command icon={List} href={href({ list: true })} active={asList}>
          List
        </Command>
        <Command icon={Columns3} href={href({ list: false })} active={!asList}>
          Board
        </Command>
        <CommandDivider />
        {/*
          A filter, not a third view — it narrows whichever view is showing.
          This is what the separate My Tasks screen used to be for, except it
          answers the question where the work already is.
        */}
        <Command icon={User} href={href({ mine: !mineOnly })} active={mineOnly}>
          My Tasks
        </Command>
        {/*
          Three more of the same thing. They narrow rather than switch, so they
          live beside My Tasks rather than beside List and Board, and each is a
          link — a board narrowed to Nike is a URL somebody can send.
        */}
        <FilterMenu
          label="Type"
          icon={Shapes}
          options={typeOptions}
          value={current.type}
          clearHref={href({ type: undefined })}
        />
        <FilterMenu
          label="Priority"
          icon={Flag}
          options={priorityOptions}
          value={current.priority}
          clearHref={href({ priority: undefined })}
        />
        <FilterMenu
          label="Tag"
          icon={Tag}
          options={tagOptions}
          value={current.tag}
          clearHref={href({ tag: undefined })}
          empty="Nothing on this board is tagged"
        />

        {/*
          What you do to the board sits at the far end, away from what you use
          to read it. New Task is the one thing everyone here does, so it takes
          the corner; shaping the board is the Account Director's job and sits
          beside it. Reports is not a board action and is already in the rail
          for everyone who can reach it.
        */}
        <div className="ml-auto flex items-center gap-1">
          {isDirector(user) ? (
            <>
              <Command icon={Settings2} href={`/boards/${boardId}/settings`}>
                Board settings
              </Command>
              <CommandDivider />
            </>
          ) : null}
          <Command icon={Plus} href="/tasks/new" tone="primary">
            New Task
          </Command>
        </div>
      </CommandBar>

      {view.columns.length === 0 ? (
        <EmptyState>This board has no columns yet.</EmptyState>
      ) : narrowed && view.total === 0 ? (
        /*
          One message rather than one per combination. Which filters are on is
          already legible in the bar above, so saying it again here would only
          be a longer sentence; what is worth adding is the way out.
        */
        <EmptyState>
          Nothing on this board matches these filters.{" "}
          <Link href={unfiltered} className="text-blue-900 underline underline-offset-2">
            Show everything
          </Link>
        </EmptyState>
      ) : asList ? (
        <div className="space-y-8">
          {view.total === 0 ? <EmptyState>Nothing on this board today.</EmptyState> : null}
          {view.columns
            .filter((column) => column.tasks.length > 0)
            .map((column) => (
              <TaskList
                key={column.id}
                title={column.name}
                tone={
                  column.kind === "blocked"
                    ? "danger"
                    : column.kind === "done"
                      ? "quiet"
                      : "default"
                }
              >
                {column.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={toTaskRow(task)}
                    onToggle={toggleTaskDone}
                    quiet={column.kind === "done"}
                  />
                ))}
              </TaskList>
            ))}
        </div>
      ) : (
        <TaskBoard
          board={toBoard(view)}
          onMove={moveTask}
          moreHref={href({ list: true })}
        />
      )}
    </>
  );
}
