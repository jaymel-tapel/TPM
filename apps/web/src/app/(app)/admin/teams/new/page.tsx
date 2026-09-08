import Link from "next/link";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";
import { createTeam } from "@/actions/admin";
import { TeamAdminForm } from "@/components/team-admin-form";

export const dynamic = "force-dynamic";

export default async function NewTeamPage() {
  const { user } = await requireSession();
  await assertCanAdminister(user);

  return (
    <>
      <PageHeader
        title="Add a team"
        subtitle="A board is created for it the first time somebody makes one."
        aside={
          <Link href="/admin" className="text-body-strong text-blue-700 hover:text-blue-800">
            ← Back to admin
          </Link>
        }
      />
      <TeamAdminForm
        action={createTeam}
        submitLabel="Add team"
        directors={[]}
        values={{ name: "", accountDirectorId: "" }}
      />
    </>
  );
}
