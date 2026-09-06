import { notFound } from "next/navigation";
import {
  ButtonLink,
  MemberList,
  MemberRow,
  NeedsAttention,
  Percent,
  Panel,
  SectionHeader,
  Stat,
  UserAvatar,
} from "@meridian/ui";
import { Progress } from "@meridian/ui/primitives/progress";
import { getTeamToday } from "@/queries/team";
import { getNeedsAttention } from "@/queries/attention";
import { teamScope } from "@/queries/sql";
import { toMemberRow } from "@/lib/present";
import { fmtLongDate, now } from "@/lib/date";

/**
 * Screen 3. The Account Director should understand the team in seconds: one
 * headline number, one line per person, then what needs them.
 */
export async function TeamTodayView({ teamId }: { teamId: string }) {
  const [team, attention] = await Promise.all([
    getTeamToday(teamId),
    getNeedsAttention(teamScope(teamId)),
  ]);
  if (!team) notFound();

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-label-12 uppercase tracking-[0.08em] text-gray-600">
            {fmtLongDate(now())}
          </p>
          <h1 className="mt-3 text-heading-32 text-gray-1000">{team.teamName}</h1>
          {team.directorName ? (
            <div className="mt-3 flex items-center gap-2">
              <UserAvatar name={team.directorName} size="sm" />
              <p className="text-copy-14 text-gray-700">
                <span className="text-gray-1000">{team.directorName}</span> · Account Director
              </p>
            </div>
          ) : null}
        </div>
        <ButtonLink href="/tasks/new">New Task</ButtonLink>
      </div>

      <Panel className="p-8">
        <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
          <Stat
            value={<Percent value={team.percent} />}
            label="Completion today"
            size="xl"
          />
          <dl className="flex flex-wrap gap-x-12 gap-y-4">
            <Stat value={team.headcount} label="People" size="sm" />
            <Stat value={team.due} label="Tasks due" size="sm" />
            <Stat value={team.done} label="Completed" size="sm" />
            <Stat
              value={team.overdue}
              label="Overdue"
              size="sm"
              tone={team.overdue > 0 ? "danger" : "default"}
            />
          </dl>
        </div>
        <Progress value={team.percent} className="mt-8 h-1.5" />
      </Panel>

      <section>
        <SectionHeader aside="Click a person to open their day">Team Members</SectionHeader>
        <MemberList>
          {team.members.map((member) => (
            <MemberRow key={member.id} member={toMemberRow(member)} />
          ))}
        </MemberList>
      </section>

      <section>
        <SectionHeader>Needs Attention</SectionHeader>
        <NeedsAttention items={attention} />
      </section>
    </div>
  );
}
