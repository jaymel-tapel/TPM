import { redirect } from "next/navigation";
import { EmptyState, PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { listBoardsForUser } from "@/queries/tasks";

export const dynamic = "force-dynamic";

/**
 * There is no board index screen: the rail already lists them. This exists so
 * the group's own label is a link like every other rail item, and it goes
 * where that label implies — the first board.
 */
export default async function BoardsPage() {
  const { user } = await requireSession();
  const boards = await listBoardsForUser(user);

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
