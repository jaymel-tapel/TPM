import { notFound } from "next/navigation";
import {
  MemberList,
  TaskBoard,
  MemberRow,
  NeedsAttention,
  Percent,
  Panel,
  SectionHeader,
  Stat,
} from "@meridian/ui";
import { Progress } from "@meridian/ui/primitives/progress";
import { getTeamToday } from "@/queries/team";
import { getBoardView } from "@/queries/tasks";
import { toBoard } from "@/lib/present";
import { setTaskStatus } from "@/actions/tasks";
import { getNeedsAttention } from "@/queries/attention";
import { teamScope } from "@/queries/sql";
import { toMemberRow } from "@/lib/present";

/**
 * Screen 3. The Account Director should understand the team in seconds: one
 * headline number, one line per person, then what needs them.
 */
export async function TeamTodayView({
  teamId,
  showTeamName = false,
}: {
  teamId: string;
  /**
   * The Account Director has one team and the rail already says so, so their
   * screen goes straight to the numbers. A Senior Director is looking at one
   * of several, and a page about a team should say which.
   */
  showTeamName?: boolean;
}) {
  const [team, attention] = await Promise.all([
    getTeamToday(teamId),
    getNeedsAttention(teamScope(teamId)),
  ]);
  if (!team) notFound();

  return (
    <div className="space-y-10">
      {showTeamName ? (
        <h1 className="text-title-1 text-gray-1000">{team.teamName}</h1>
      ) : null}

      <Panel className="p-8">
        <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
          <Stat
            value={<Percent value={team.percent} />}
            label="Completion today"
            size="xl"
          />
          <dl className="flex flex-wrap gap-x-12 gap-y-4 sm:ml-auto">
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
