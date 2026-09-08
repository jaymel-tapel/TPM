import { notFound } from "next/navigation";
import { BarChart3, Plus, Settings2 } from "lucide-react";
import { Command, CommandBar, CommandDivider, EmptyState, TaskBoard } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { canViewTeam, isDirector } from "@/lib/permissions";
import { getBoard } from "@/queries/boards";
import { getBoardView } from "@/queries/tasks";
import { toBoard } from "@/lib/present";
import { setTaskStatus } from "@/actions/tasks";

export const dynamic = "force-dynamic";

/**
 * A board is a working surface, so the page is the board and nothing else —
 * no date, no team name, no rollup. Those answer "where am I" and "how are we
 * doing", which the rail and the team screen already answer, and neither is a
 * question anyone has while moving cards.
 */
export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
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
        <Command icon={Plus} href="/tasks/new" tone="primary">
          New Task
        </Command>
        {isDirector(user) ? (
          <>
            <CommandDivider />
            <Command icon={Settings2} href={`/boards/${boardId}/settings`}>
              Columns
            </Command>
            <Command icon={BarChart3} href="/reports">
              Reports
            </Command>
          </>
        ) : null}
      </CommandBar>

      {view.columns.length === 0 ? (
        <EmptyState>This board has no columns yet.</EmptyState>
      ) : (
        <TaskBoard
          board={toBoard(view)}
          onMove={setTaskStatus}
          moreHref="/my-tasks"
        />
      )}
    </>
  );
}
