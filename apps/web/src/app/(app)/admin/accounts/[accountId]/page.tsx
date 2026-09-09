import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";
import { getAdminAccount, listDirectorOptions } from "@/queries/admin";
import { updateAccount } from "@/actions/admin";
import { AccountAdminForm } from "@/components/account-admin-form";

export const dynamic = "force-dynamic";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { user } = await requireSession();
  await assertCanAdminister(user);

  const [account, directors] = await Promise.all([
    getAdminAccount(accountId),
    listDirectorOptions(accountId),
  ]);
  if (!account) notFound();

  return (
    <>
      <PageHeader
        title={account.name}
        subtitle={`${account.headcount} ${account.headcount === 1 ? "person" : "people"} · ${account.boardCount} ${account.boardCount === 1 ? "board" : "boards"}`}
        aside={
          <Link href="/admin" className="text-body-strong text-blue-700 hover:text-blue-800">
            ← Back to admin
          </Link>
        }
      />
      <AccountAdminForm
        action={updateAccount}
        submitLabel="Save changes"
        directors={directors}
        values={{
          id: account.id,
          name: account.name,
          accountDirectorId: account.accountDirectorId ?? "",
        }}
      />
    </>
  );
}
