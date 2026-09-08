import { notFound } from "next/navigation";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { isSenior } from "@/lib/permissions";
import { listAccounts, listAccountsById } from "@/queries/accounts";
import { NewBoardForm } from "./new-board-form";

export const dynamic = "force-dynamic";

/**
 * An Account Director has exactly one account, so there is nothing to choose here
 * beyond the name. The Senior Director spans both, and can also file a board
 * under no account at all — the department's own work, which belongs to nobody
 * and so to everybody.
 */
export default async function NewBoardPage() {
  const { user } = await requireSession();

  if (isSenior(user)) {
    const all = await listAccounts();
    return (
      <>
        <PageHeader
          title="New board"
          subtitle="A place for work to live. You can add columns once it exists."
        />
        <NewBoardForm accounts={all.map((t) => ({ id: t.id, name: t.name }))} />
      </>
    );
  }

  if (user.role !== "account_director" || user.directedIds.length === 0) notFound();
  const mine = await listAccountsById(user.directedIds);
  if (mine.length === 0) notFound();

  /*
   * A director carrying one account gets it filled in; a director carrying
   * three has to say which. The picker is the same one the Senior Director
   * gets, narrowed to the accounts this person actually runs — offering the
   * rest would be advertising a door `assertCanManageAccount` then shuts.
   */
  return (
    <>
      <PageHeader
        eyebrow={mine.length === 1 ? mine[0]!.name : undefined}
        title="New board"
        subtitle="A place for work to live. You can add columns once it exists."
      />
      {mine.length === 1 ? (
        <NewBoardForm accounts={[]} fixedAccount={mine[0]!} />
      ) : (
        <NewBoardForm accounts={mine} />
      )}
    </>
  );
}
