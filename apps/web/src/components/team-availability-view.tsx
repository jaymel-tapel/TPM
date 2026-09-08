import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LeaveRequestList,
  LeaveRequestRow,
  MemberList,
  MemberRow,
  PageHeader,
  SectionHeader,
} from "@meridian/ui";
import type { User } from "@/db/schema";
import { now, type Zone } from "@/lib/date";
import { addDays, dayKey } from "@/lib/leave";
import { getTeamToday } from "@/queries/team";
import { listMyLeave, listTeamLeave } from "@/queries/leave";
import { toLeaveRequest, toMemberRow } from "@/lib/present";
import { CancelLeaveButton } from "@/components/leave-buttons";
import { RangeSwitch } from "@/components/range-switch";
import { RANGE_DAYS, RANGE_LABEL, type TeamRange } from "@/lib/range";

/** How far ahead "coming up" looks. A fortnight is as far as a rota is real. */
const HORIZON_DAYS = 14;

/**
 * The team, for the people on it.
 *
 * The same numbers their director reads — a team's workload is the team's own
 * business, the way its board and its documents already are. What stays behind
 * `canViewTeam` is the management *screen*: the headline the department is
 * judged on, Needs Attention, and the queue of decisions only a director makes.
 *
 * The rows are not links, though. `assertCanViewUser` opens one person's day
 * for a team member — their own — so everybody else's row is plain rather than
 * a door that 404s.
 */
export async function TeamAvailabilityView({
  viewer,
  teamId,
  zone,
  range,
}: {
  viewer: User;
  teamId: string;
  zone?: Zone;
  range: TeamRange;
}) {
  const reference = now(zone);
  const today = dayKey(reference, zone);

  const [team, upcoming, mine] = await Promise.all([
    // One call rather than a roster plus an availability lookup: `getTeamToday`
    // already returns both, and it puts the Account Director first.
    getTeamToday(teamId, undefined, zone, RANGE_DAYS[range]),
    listTeamLeave(viewer, teamId, addDays(today, 1), addDays(today, HORIZON_DAYS)),
    listMyLeave(viewer),
  ]);
  if (!team) notFound();

  const outToday = team.members.filter((m) => m.away);

  return (
    <>
      <PageHeader
        title="Your team"
        subtitle="Who is in, who is off, and where your own leave stands."
      />

      <RangeSwitch range={range} basePath="/team" className="mb-6" />

      <div className="space-y-10">
        <section>
          <SectionHeader
            aside={
              outToday.length === 0
                ? "Everyone is in"
                : `${outToday.length} away`
            }
          >
            {RANGE_LABEL[range]}
          </SectionHeader>
          <MemberList>
            {team.members.map((member) => (
              <MemberRow
                key={member.id}
                member={toMemberRow(
                  member,
                  // Their own day is the one page `assertCanViewUser` opens for
                  // them; everybody else's row is not a link.
                  member.id === viewer.id ? "/team" : null,
                  reference,
                  zone,
                )}
              />
            ))}
          </MemberList>
        </section>

        <section>
          <SectionHeader>Coming up</SectionHeader>
          <LeaveRequestList empty="Nobody is booked off in the next fortnight.">
            {upcoming.map((row) => (
              <LeaveRequestRow
                key={row.id}
                request={toLeaveRequest(row, viewer, reference, zone)}
              />
            ))}
          </LeaveRequestList>
        </section>

        <section>
          <SectionHeader
            aside={
              <Link
                href="/leave"
                className="text-body-strong text-blue-700 hover:text-blue-800"
              >
                File for leave →
              </Link>
            }
          >
            Your leave
          </SectionHeader>
          <LeaveRequestList empty="You have not filed for any leave.">
            {mine.slice(0, 5).map((row) => {
              const request = toLeaveRequest(row, viewer, reference, zone);
              return (
                <LeaveRequestRow
                  key={row.id}
                  request={request}
                  showPerson={false}
                  actions={request.cancellable ? <CancelLeaveButton id={request.id} /> : null}
                />
              );
            })}
          </LeaveRequestList>
        </section>
      </div>
    </>
  );
}
