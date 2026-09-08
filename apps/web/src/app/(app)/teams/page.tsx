import Link from "next/link";
import { notFound } from "next/navigation";
import { Progress } from "@meridian/ui/primitives/progress";
import {
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
import { toMemberRow } from "@/lib/present";
import { fmtLongDate, now } from "@/lib/date";

export const dynamic = "force-dynamic";

/** Both teams side by side, then straight into the people. */
export default async function TeamsPage() {
  const { user, zone } = await requireSession();
  if (!isSenior(user)) notFound();

  const dept = await getDepartmentToday(undefined, zone);
  const rosters = await Promise.all(dept.teams.map((t) => getTeamToday(t.id, undefined, zone)));

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
                  <MemberRow key={m.id} member={toMemberRow(m)} />
                ))}
              </MemberList>
            </section>
          ) : null,
        )}
      </div>
    </>
  );
}
