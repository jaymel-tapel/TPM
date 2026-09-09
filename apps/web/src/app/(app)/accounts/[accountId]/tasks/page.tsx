import { notFound, redirect } from "next/navigation";
import { openAccount } from "@/lib/account-page";
import { listBoardsForAccounts } from "@/queries/tasks";

export const dynamic = "force-dynamic";

/**
 * Tasks has no page of its own — it opens on the account's first board.
 *
 * A combined view across boards was the alternative and it does not survive
 * contact with the Board mode: two boards have two sets of columns, and there
 * is no honest way to draw both at once. One board at a time keeps the columns
 * meaningful, and the rail lists the rest a click away.
 */
export default async function AccountTasksPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  await openAccount(accountId);

  const boards = await listBoardsForAccounts([accountId]);
  const first = boards[0];
  if (!first) notFound();
  redirect(`/accounts/${accountId}/tasks/${first.id}`);
}
