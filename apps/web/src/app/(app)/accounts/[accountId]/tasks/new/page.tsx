import { notFound } from "next/navigation";
import { PageHeader } from "@tpm/ui";
import { openAccount } from "@/lib/account-page";
import { canViewAccount } from "@/lib/permissions";
import { NewBoardForm } from "./new-board-form";

export const dynamic = "force-dynamic";

/**
 * A second board for a client.
 *
 * Inside the account, not in a section of its own — a board belongs to one
 * client and exists so their creative and their media work can move through
 * different stages. The account is fixed by the URL; there is nothing to pick.
 */
export default async function NewBoardPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { user, account } = await openAccount(accountId);
  if (!canViewAccount(user, accountId)) notFound();

  return (
    <>
      <PageHeader
        eyebrow={account.name}
        title="New board"
        subtitle="A set of stages this client's work moves through. You can name the columns once it exists."
      />
      <NewBoardForm accountId={accountId} />
    </>
  );
}
