import Link from "next/link";
import { notFound } from "next/navigation";
import { Progress } from "@meridian/ui/primitives/progress";
import {
  LeaveRequestList,
  LeaveRequestRow,
  MemberList,
  MemberRow,
  PageHeader,
  Panel,
  Percent,
  SectionHeader,
  UserAvatar,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { isSenior } from "@/lib/permissions";
import { getDepartmentToday } from "@/queries/department";
import { getTeamToday } from "@/queries/team";
import { toLeaveRequest, toMemberRow } from "@/lib/present";
import { listPendingFor } from "@/queries/leave";
import { LeaveDecision } from "@/components/leave-buttons";
import { fmtLongDate, now } from "@/lib/date";

export const dynamic = "force-dynamic";

/** Both teams side by side, then straight into the people. */
export default async function TeamsPage() {
  const { user, zone } = await requireSession();
  if (!isSenior(user)) notFound();

  const reference = now(zone);
  const dept = await getDepartmentToday(undefined, zone);
  const [rosters, pending] = await Promise.all([
    Promise.all(dept.teams.map((t) => getTeamToday(t.id, undefined, zone))),
    // Whose leave only the Senior Director can settle: both Account
    // Directors'. Nobody signs off their own, so this queue exists precisely
    // because the org chart runs out above them.
    listPendingFor(user),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={fmtLongDate(now(zone), zone)}
        title="Teams"
        subtitle="Both teams side by side, then straight into the people."
      />

      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        {dept.teams.map((team) => (
          <Panel key={team.id} className="p-6">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-subtitle-1 text-gray-1000">{team.name}</p>
              <p className="tabular text-title-1 text-gray-1000">
                <Percent value={team.percent} />
              </p>
            </div>
            <Progress value={team.percent} className="mt-4 h-1.5" />
            <div className="mt-4 flex items-center gap-2 border-t border-gray-300 pt-4">
              {team.directorName ? <UserAvatar name={team.directorName} size="sm" /> : null}
              <p className="tabular text-caption text-gray-700">
                <span className="text-gray-1000">{team.directorName}</span>
                {` · ${team.done}/${team.due} today · ${team.overdue} overdue · ${team.headcount} people`}
              </p>
            </div>
          </Panel>
        ))}
      </div>

      <div className="space-y-10">
        {rosters.map((team) =>
          team ? (
            <section key={team.teamId}>
              <SectionHeader
                aside={
                  <Link
                    href={`/teams/${team.teamId}`}
                    className="text-body-strong text-blue-700 hover:text-blue-800"
                  >
                    Open team view →
                  </Link>
                }
              >
                {team.teamName}
              </SectionHeader>
              <MemberList>
                {team.members.map((m) => (
                  <MemberRow key={m.id} member={toMemberRow(m, "/team", reference, zone)} />
                ))}
              </MemberList>
            </section>
          ) : null,
        )}

        {pending.length > 0 ? (
          <section>
            <SectionHeader aside={`${pending.length} awaiting you`}>
              Leave requests
            </SectionHeader>
            <LeaveRequestList empty="Nothing is waiting on you.">
              {pending.map((row) => (
                <LeaveRequestRow
                  key={row.id}
                  request={toLeaveRequest(row, user, reference, zone)}
                  actions={<LeaveDecision id={row.id} />}
                />
              ))}
            </LeaveRequestList>
          </section>
        ) : null}
      </div>
    </>
  );
}
