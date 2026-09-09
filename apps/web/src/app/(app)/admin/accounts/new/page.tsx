import Link from "next/link";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";
import { createAccount } from "@/actions/admin";
import { AccountAdminForm } from "@/components/account-admin-form";

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const { user } = await requireSession();
  await assertCanAdminister(user);

  return (
    <>
      <PageHeader
        title="Add an account"
        subtitle="A board is created for it the first time somebody makes one."
        aside={
          <Link href="/admin" className="text-body-strong text-blue-700 hover:text-blue-800">
            ← Back to admin
          </Link>
        }
      />
      <AccountAdminForm
        action={createAccount}
        submitLabel="Add account"
        directors={[]}
        values={{ name: "", accountDirectorId: "" }}
      />
    </>
  );
}
