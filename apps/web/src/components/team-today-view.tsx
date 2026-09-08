import { notFound } from "next/navigation";
import { BarChart3, Columns3, List, Plus } from "lucide-react";
import {
  Command,
  CommandBar,
  CommandDivider,
  MemberList,
  TaskBoard,
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
import { getBoardView } from "@/queries/tasks";
import { toBoard } from "@/lib/present";
import { setTaskStatus } from "@/actions/tasks";
import { getNeedsAttention } from "@/queries/attention";
import { teamScope } from "@/queries/sql";
import { toMemberRow } from "@/lib/present";
import { fmtLongDate, now } from "@/lib/date";

/**
 * Screen 3. The Account Director should understand the team in seconds: one
 * headline number, one line per person, then what needs them.
 */
export async function TeamTodayView({
  teamId,
  view = "list",
  basePath,
}: {
  teamId: string;
  view?: "list" | "board";
  /** Where the List / Board toggle should point. */
  basePath: string;
}) {
  const [team, attention, board] = await Promise.all([
    getTeamToday(teamId),
    getNeedsAttention(teamScope(teamId)),
    view === "board" ? getBoardView(teamScope(teamId)) : Promise.resolve(null),
  ]);
  if (!team) notFound();

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-caption-strong uppercase tracking-[0.08em] text-gray-600">
            {fmtLongDate(now())}
          </p>
          <h1 className="mt-3 text-title-1 text-gray-1000">{team.teamName}</h1>
          {team.directorName ? (
            <div className="mt-3 flex items-center gap-2">
              <UserAvatar name={team.directorName} size="sm" />
              <p className="text-body text-gray-700">
                <span className="text-gray-1000">{team.directorName}</span> · Account Director
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <CommandBar>
        <Command icon={Plus} href="/tasks/new" tone="primary">
          New Task
        </Command>
        <CommandDivider />
        <Command icon={List} href={basePath} active={view === "list"}>
          List
        </Command>
        <Command icon={Columns3} href={`${basePath}?view=board`} active={view === "board"}>
          Board
        </Command>
        <CommandDivider />
        <Command icon={BarChart3} href="/reports">
          Reports
        </Command>
      </CommandBar>

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

      {board ? (
        <section>
          <SectionHeader aside="Drag a card to move it, or open it to change anything else">
            Board
          </SectionHeader>
          <TaskBoard board={toBoard(board)} onMove={setTaskStatus} moreHref={basePath} />
        </section>
      ) : (
        <section>
          <SectionHeader aside="Click a person to open their day">Team Members</SectionHeader>
          <MemberList>
            {team.members.map((member) => (
              <MemberRow key={member.id} member={toMemberRow(member)} />
            ))}
          </MemberList>
        </section>
      )}

      <section>
        <SectionHeader>Needs Attention</SectionHeader>
        <NeedsAttention items={attention} />
      </section>
    </div>
  );
}
