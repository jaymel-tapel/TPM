import "server-only";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { assertCanViewAccountWork } from "@/lib/permissions";
import { getAccount } from "@/queries/accounts";

/**
 * The door into an account's section, opened once rather than four times.
 *
 * Every page under `/accounts/[accountId]` needs the same three things: the
 * viewer, the account, and the guard between them. Four copies of that is four
 * chances for one of them to check a slightly different thing — which is how a
 * section ends up with one page that refuses and three that do not.
 *
 * `canViewAccountWork`, not `canViewAccount`: these are the client's own pages
 * and everyone servicing it may read them. The management parts inside — Needs
 * Attention, the leave queue — ask the narrower question themselves.
 */
export async function openAccount(accountId: string) {
  const { user, zone } = await requireSession();
  await assertCanViewAccountWork(user, accountId);
  const account = await getAccount(accountId);
  if (!account) notFound();
  return { user, zone, account };
}
