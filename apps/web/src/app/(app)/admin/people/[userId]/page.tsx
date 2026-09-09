import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";
import { getPerson, listAccountOptions } from "@/queries/admin";
import { updatePerson } from "@/actions/admin";
import { PersonForm } from "@/components/person-form";
import { ResetPassword } from "@/components/reset-password";

export const dynamic = "force-dynamic";

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const { user } = await requireSession();
  await assertCanAdminister(user);

  const [person, accounts] = await Promise.all([getPerson(userId), listAccountOptions()]);
  if (!person) notFound();

  return (
    <>
      <PageHeader
        title={person.name}
        subtitle={
          person.taskCount > 0
            ? `On ${person.taskCount} ${person.taskCount === 1 ? "task" : "tasks"}. Moving them off an account leaves the work where it is.`
            : "Not on any work yet."
        }
        aside={
          <Link href="/admin" className="text-body-strong text-blue-700 hover:text-blue-800">
            ← Back to admin
          </Link>
        }
      />
      <PersonForm
        action={updatePerson}
        submitLabel="Save changes"
        accounts={accounts}
        values={{
          id: person.id,
          name: person.name,
          email: person.email,
          role: person.role,
          accountIds: person.accounts.map((a) => a.id),
          title: person.title,
        }}
      />

      <div className="mt-6">
        <ResetPassword userId={person.id} name={person.name} isSelf={person.id === user.id} />
      </div>
    </>
  );
}
