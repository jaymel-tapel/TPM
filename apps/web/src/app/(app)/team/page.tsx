import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { assertCanViewTeamWork, canViewTeam } from "@/lib/permissions";
import { TeamTodayView } from "@/components/team-today-view";
import { TeamAvailabilityView } from "@/components/team-availability-view";

export const dynamic = "force-dynamic";

/**
 * Your team.
 *
 * One route, because there is only one thing a person means by "my team" — but
 * two screens, because the two readers are asking different questions. The
 * door opens for anyone on the team, which is `canViewTeamWork`'s rule and the
 * same one their board follows; `canViewTeam` then decides *which* screen,
 * rather than whether there is one.
 *
 * Both screens report the same per-person numbers: a team's workload is the
 * team's own business. What stays behind `canViewTeam` is the management
 * screen around them — the headline, the exceptions, the approval queue — and
 * the right to open a colleague's day, which is why a member's roster rows are
 * not links. `canViewTeam` itself is untouched, and its test still asserts it
 * refuses a team member.
 */
export default async function TeamPage() {
  const { user, zone } = await requireSession();
  // The Senior Director is on no team and browses via /teams.
  if (!user.teamId) notFound();
  await assertCanViewTeamWork(user, user.teamId);

  return canViewTeam(user, user.teamId) ? (
    <TeamTodayView viewer={user} teamId={user.teamId} zone={zone} />
  ) : (
    <TeamAvailabilityView viewer={user} teamId={user.teamId} zone={zone} />
  );
}
