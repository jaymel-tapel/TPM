import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LeaveRequestList,
  LeaveRequestRow,
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
import type { Zone } from "@/lib/date";
import { getTeamToday } from "@/queries/team";
import { getBoardView } from "@/queries/tasks";
import { toBoard } from "@/lib/present";
import { setTaskStatus } from "@/actions/tasks";
import { getNeedsAttention } from "@/queries/attention";
import { teamScope } from "@/queries/sql";
import { toLeaveRequest, toMemberRow } from "@/lib/present";
import { listPendingFor, listTeamLeave } from "@/queries/leave";
import { addDays, dayKey } from "@/lib/leave";
import { now } from "@/lib/date";
import type { User } from "@/db/schema";
import { LeaveDecision } from "@/components/leave-buttons";

/** How far ahead the leave list looks. A fortnight is as far as a rota is real. */
const LEAVE_HORIZON_DAYS = 14;

/**
 * Screen 3. The Account Director should understand the team in seconds: one
 * headline number, one line per person, then what needs them.
 */
export async function TeamTodayView({
  viewer,
  teamId,
  zone,
  showTeamName = false,
}: {
  /** Whose queue the Leave section shows. */
  viewer: User;
  teamId: string;
  /** The reader's timezone — a team's "today" is reckoned by whoever opens it. */
  zone?: Zone;
  /**
   * The Account Director has one team and the rail already says so, so their
   * screen goes straight to the numbers. A Senior Director is looking at one
   * of several, and a page about a team should say which.
   */
  showTeamName?: boolean;
}) {
  const reference = now(zone);
  const today = dayKey(reference, zone);

  const [team, attention, pending, upcoming] = await Promise.all([
    getTeamToday(teamId, undefined, zone),
    getNeedsAttention(teamScope(teamId), undefined, zone),
    listPendingFor(viewer),
    // Who is out today is already on the member rows, so this is only the
    // fortnight ahead — saying it twice on one screen would be noise.
    listTeamLeave(viewer, teamId, addDays(today, 1), addDays(today, LEAVE_HORIZON_DAYS)),
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
              <MemberRow
                key={member.id}
                member={toMemberRow(member, "/team", reference, zone)}
              />
            ))}
          </MemberList>
      </section>

      {/*
        Two different things, kept apart. Pending is a queue — it needs a
        decision, and its number is a to-do. Upcoming is a schedule — it needs
        nothing, and it is a list. Merging them would make the count meaningless.
      */}
      <section>
        <SectionHeader
          aside={
            <Link href="/leave" className="text-body-strong text-blue-700 hover:text-blue-800">
              {pending.length > 0 ? `${pending.length} awaiting you →` : "Leave →"}
            </Link>
          }
        >
          Leave
        </SectionHeader>
        <LeaveRequestList empty="Nobody is booked off in the next fortnight.">
          {upcoming.map((row) => (
            <LeaveRequestRow
              key={row.id}
              request={toLeaveRequest(row, viewer, reference, zone)}
            />
          ))}
        </LeaveRequestList>
      </section>

      {pending.length > 0 ? (
        <section>
          <SectionHeader aside={`${pending.length} awaiting you`}>
            Leave requests
          </SectionHeader>
          <LeaveRequestList empty="Nothing is waiting on you.">
            {pending.map((row) => (
              <LeaveRequestRow
                key={row.id}
                request={toLeaveRequest(row, viewer, reference, zone)}
                actions={<LeaveDecision id={row.id} />}
              />
            ))}
          </LeaveRequestList>
        </section>
      ) : null}

      <section>
        <SectionHeader>Needs Attention</SectionHeader>
        <NeedsAttention items={attention} />
      </section>
    </div>
  );
}
