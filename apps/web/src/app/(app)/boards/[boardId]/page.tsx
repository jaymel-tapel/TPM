import { notFound } from "next/navigation";
import { Columns3, List, Plus, Settings2 } from "lucide-react";
import {
  Command,
  CommandBar,
  CommandDivider,
  EmptyState,
  TaskBoard,
  TaskList,
  TaskRow,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { canViewTeam, isDirector } from "@/lib/permissions";
import { getBoard } from "@/queries/boards";
import { getBoardView } from "@/queries/tasks";
import { toBoard, toTaskRow } from "@/lib/present";
import { setTaskStatus, toggleTaskDone } from "@/actions/tasks";

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
  const asList = query.view === "list";
  const { user } = await requireSession();

  const board = await getBoard(boardId);
  if (!board || !canViewTeam(user, board.teamId)) notFound();

  const view = await getBoardView(boardId);
  if (!view) notFound();

  return (
    <>
      <CommandBar className="sticky top-0 z-20 -mx-8 mb-6 border-b border-gray-300 bg-background px-8 py-3">
        <span className="mr-2 text-subtitle-2 text-gray-1000">{board.name}</span>
        <CommandDivider />
        {/*
          Columns or a list — of the same board. The switch means something
          again now that a board is a place: before, "list" and "board" were
          two lenses on a whole team's day and the pairing was arbitrary. The
          list keeps the board's own columns as its headings, so the vocabulary
          an Account Director chose survives the switch.
        */}
        <Command icon={List} href={`/boards/${boardId}?view=list`} active={asList}>
          List
        </Command>
        <Command icon={Columns3} href={`/boards/${boardId}`} active={!asList}>
          Board
        </Command>

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
        <TaskBoard board={toBoard(view)} onMove={setTaskStatus} moreHref="/my-tasks" />
      )}
    </>
  );
}
