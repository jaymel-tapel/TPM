import Link from "next/link";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";
import { listAccountOptions } from "@/queries/admin";
import { createPerson } from "@/actions/admin";
import { PersonForm } from "@/components/person-form";

export const dynamic = "force-dynamic";

export default async function NewPersonPage() {
  const { user } = await requireSession();
  await assertCanAdminister(user);
  const accounts = await listAccountOptions();

  return (
    <>
      <PageHeader
        title="Add a person"
        subtitle="They get a first password to hand over, shown once."
        aside={
          <Link href="/admin" className="text-body-strong text-blue-700 hover:text-blue-800">
            ← Back to admin
          </Link>
        }
      />
      <PersonForm
        action={createPerson}
        submitLabel="Add person"
        accounts={accounts}
        values={{ name: "", email: "", role: "team_member", title: null, accountIds: [] }}
      />
    </>
  );
}
