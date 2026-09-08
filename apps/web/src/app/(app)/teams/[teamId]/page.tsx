import { requireSession } from "@/lib/auth";
import { assertCanViewTeam } from "@/lib/permissions";
import { TeamTodayView } from "@/components/team-today-view";

export const dynamic = "force-dynamic";

/** Same view an Account Director sees — the SD just gets to pick the team. */
export default async function TeamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teamId } = await params;
  const { user, zone } = await requireSession();
  await assertCanViewTeam(user, teamId);

  const view = (await searchParams).view === "board" ? "board" : "list";
  return (
    <TeamTodayView viewer={user} teamId={teamId} zone={zone} showTeamName />
  );
}
