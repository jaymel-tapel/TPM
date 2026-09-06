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
  const { user } = await requireSession();
  if (!isSenior(user)) notFound();

  const dept = await getDepartmentToday();
  const rosters = await Promise.all(dept.teams.map((t) => getTeamToday(t.id)));

  return (
    <>
      <PageHeader
        eyebrow={fmtLongDate(now())}
        title="Teams"
        subtitle="Both teams side by side, then straight into the people."
      />

      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        {dept.teams.map((team) => (
          <Panel key={team.id} className="p-6">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-heading-20 text-gray-1000">{team.name}</p>
              <p className="tabular text-heading-32 text-gray-1000">
                <Percent value={team.percent} />
              </p>
            </div>
            <Progress value={team.percent} className="mt-4 h-1.5" />
            <div className="mt-4 flex items-center gap-2 border-t border-gray-300 pt-4">
              {team.directorName ? <UserAvatar name={team.directorName} size="sm" /> : null}
              <p className="tabular text-copy-13 text-gray-700">
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
                    className="text-label-14 text-blue-700 hover:text-blue-800"
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
