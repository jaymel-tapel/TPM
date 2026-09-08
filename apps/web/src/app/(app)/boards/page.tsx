import Link from "next/link";
import { redirect } from "next/navigation";
import { Columns3 } from "lucide-react";
import { EmptyState, PageHeader, Panel, SectionHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { isSenior } from "@/lib/permissions";
import { listBoardsForUser } from "@/queries/tasks";

export const dynamic = "force-dynamic";

/**
 * For most people there is no board index: the rail already lists the two or
 * three they can reach, so this label goes where it implies — the first board.
 *
 * The Senior Director is the exception. They see every team's boards, two
 * teams can name a board the same thing, and "the first one" is not a place
 * anybody meant to go. They get the list, grouped by the team that owns it.
 */
export default async function BoardsPage() {
  const { user } = await requireSession();
  const boards = await listBoardsForUser(user);

  if (!isSenior(user)) {
    if (boards[0]) redirect(`/boards/${boards[0].id}`);
    return (
      <>
        <PageHeader title="Boards" subtitle="Work lives on a board." />
        <EmptyState>
          No boards yet. An Account Director creates them for their team.
        </EmptyState>
      </>
    );
  }

  // Grouped in the order the query returns them, which is by team then name.
  const byTeam = new Map<string, { teamName: string; boards: typeof boards }>();
  for (const board of boards) {
    // The department's own boards group under one heading of their own rather
    // than being filed under a team they do not belong to.
    const key = board.teamId ?? "department";
    const label = board.teamName ?? "Department";
    const group = byTeam.get(key);
    if (group) group.boards.push(board);
    else byTeam.set(key, { teamName: label, boards: [board] });
  }

  return (
    <>
      <PageHeader
        title="Boards"
        subtitle="Every team's work, and who it belongs to."
      />

      {boards.length === 0 ? (
        <EmptyState>
          No boards yet. An Account Director creates them for their team.
        </EmptyState>
      ) : (
        [...byTeam.values()].map((group) => (
          <div key={group.teamName} className="mb-10">
            <SectionHeader
              aside={`${group.boards.length} ${group.boards.length === 1 ? "board" : "boards"}`}
            >
              {group.teamName}
            </SectionHeader>
            <Panel>
              <ul className="divide-y divide-gray-300">
                {group.boards.map((board) => (
                  <li key={board.id}>
                    <Link
                      href={`/boards/${board.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-100"
                    >
                      <Columns3 className="size-4 shrink-0 text-gray-600" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1 truncate text-body-strong text-gray-1000">
                        {board.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        ))
      )}
    </>
  );
}
