import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Command, CommandBar, PageHeader } from "@meridian/ui";
import { openAccount } from "@/lib/account-page";
import { canViewAccount } from "@/lib/permissions";
import { listBoardsForAccounts } from "@/queries/tasks";
import { listBoardStatuses } from "@/queries/boards";
import { BoardSettings } from "./board-settings";

export const dynamic = "force-dynamic";

/**
 * The columns an account's Tasks page is drawn with.
 *
 * This used to live at `/boards/[id]/settings`, which made a board look like a
 * thing you navigate to. It is not: it is the vocabulary one client's work is
 * sorted into, so it sits inside that client's Tasks, reachable from the board
 * it shapes and nowhere else.
 */
export default async function BoardColumnsPage({
  params,
}: {
  params: Promise<{ accountId: string; boardId: string }>;
}) {
  const { accountId, boardId } = await params;
  const { user, account } = await openAccount(accountId);

  // Shaping the columns is the Account Director's job, so a team member who
  // guesses the URL gets the same answer as one who guesses a wrong id.
  if (!canViewAccount(user, accountId)) notFound();

  // The board has to be this account's; a stray id from another client would
  // otherwise let a director reshape a board they do not run.
  const boards = await listBoardsForAccounts([accountId]);
  const board = boards.find((b) => b.id === boardId);
  if (!board) notFound();
  const columns = await listBoardStatuses(board.id);

  return (
    <>
      <PageHeader
        eyebrow={`${account.name} · ${board.name}`}
        title="Columns"
        subtitle="What the columns are called, and what each one means."
        commands={
          <CommandBar>
            <Command icon={ArrowLeft} href={`/accounts/${accountId}/tasks/${boardId}`}>
              Back to the board
            </Command>
          </CommandBar>
        }
      />
      <BoardSettings boardId={board.id} columns={columns} />
    </>
  );
}
