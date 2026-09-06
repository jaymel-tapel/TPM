import { requireSession } from "@/lib/auth";
import { assertCanViewTeam } from "@/lib/permissions";
import { TeamTodayView } from "@/components/team-today-view";

export const dynamic = "force-dynamic";

/** Same view an Account Director sees — the SD just gets to pick the team. */
export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { user } = await requireSession();
  await assertCanViewTeam(user, teamId);

  return <TeamTodayView teamId={teamId} />;
}
