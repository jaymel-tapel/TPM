import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";
import { getAdminTeam, listDirectorOptions } from "@/queries/admin";
import { updateTeam } from "@/actions/admin";
import { TeamAdminForm } from "@/components/team-admin-form";

export const dynamic = "force-dynamic";

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { user } = await requireSession();
  await assertCanAdminister(user);

  const [team, directors] = await Promise.all([
    getAdminTeam(teamId),
    listDirectorOptions(teamId),
  ]);
  if (!team) notFound();

  return (
    <>
      <PageHeader
        title={team.name}
        subtitle={`${team.headcount} ${team.headcount === 1 ? "person" : "people"} · ${team.boardCount} ${team.boardCount === 1 ? "board" : "boards"}`}
        aside={
          <Link href="/admin" className="text-body-strong text-blue-700 hover:text-blue-800">
            ← Back to admin
          </Link>
        }
      />
      <TeamAdminForm
        action={updateTeam}
        submitLabel="Save changes"
        directors={directors}
        values={{
          id: team.id,
          name: team.name,
          accountDirectorId: team.accountDirectorId ?? "",
        }}
      />
    </>
  );
}
