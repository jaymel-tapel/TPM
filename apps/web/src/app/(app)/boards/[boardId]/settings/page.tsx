import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Command, CommandBar, PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { isSenior } from "@/lib/permissions";
import { getBoard, listBoardStatuses } from "@/queries/boards";
import { BoardSettings } from "./board-settings";

export const dynamic = "force-dynamic";

export default async function BoardSettingsPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const { user } = await requireSession();

  const board = await getBoard(boardId);
  if (!board) notFound();

  // Managing a board is the Account Director's job, so a team member who
  // guesses the URL gets the same answer as one who guesses a wrong id.
  const canManage =
    isSenior(user) ||
    (user.role === "account_director" &&
      board.accountId !== null &&
      user.directedIds.includes(board.accountId));
  if (!canManage) notFound();

  const columns = await listBoardStatuses(boardId);

  return (
    <>
      <PageHeader
        eyebrow={board.accountName}
        title={board.name}
        subtitle="What the columns are called, and what each one means."
        commands={
          <CommandBar>
            <Command icon={ArrowLeft} href={`/boards/${boardId}`}>
              Back to board
            </Command>
          </CommandBar>
        }
      />
      <BoardSettings boardId={boardId} boardName={board.name} columns={columns} />
    </>
  );
}
