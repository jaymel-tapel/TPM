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
import type { Viewer } from "@/lib/auth";
import { now, type Zone } from "@/lib/date";
import { addDays, dayKey } from "@/lib/leave";
import { getAccountToday } from "@/queries/accounts";
import { listMyLeave, listAccountLeave } from "@/queries/leave";
import { toLeaveRequest, toMemberRow } from "@/lib/present";
import { CancelLeaveButton } from "@/components/leave-buttons";
import { RangeSwitch } from "@/components/range-switch";
import { RANGE_DAYS, RANGE_LABEL, type RangeKind } from "@/lib/range";

/** How far ahead "coming up" looks. A fortnight is as far as a rota is real. */
const HORIZON_DAYS = 14;

/**
 * The account, for the people on it.
 *
 * The same numbers their director reads — an account's workload is the account's own
 * business, the way its board and its documents already are. What stays behind
 * `canViewAccount` is the management *screen*: the headline the department is
 * judged on, Needs Attention, and the queue of decisions only a director makes.
 *
 * The rows are not links, though. `assertCanViewUser` opens one person's day
 * for a team member — their own — so everybody else's row is plain rather than
 * a door that 404s.
 */
export async function AccountAvailabilityView({
  viewer,
  accountId,
  zone,
  range,
  basePath,
}: {
  viewer: Viewer;
  accountId: string;
  zone?: Zone;
  range: RangeKind;
  /** Where the range switch points back to — this account's own route. */
  basePath: string;
}) {
  const reference = now(zone);
  const today = dayKey(reference, zone);

  const [account, upcoming, mine] = await Promise.all([
    // One call rather than a roster plus an availability lookup: `getAccountToday`
    // already returns both, and it puts the Account Director first.
    getAccountToday(accountId, undefined, zone, RANGE_DAYS[range]),
    listAccountLeave(viewer, accountId, addDays(today, 1), addDays(today, HORIZON_DAYS)),
    listMyLeave(viewer),
  ]);
  if (!account) notFound();

  const outToday = account.members.filter((m) => m.away);

  return (
    <>
      <PageHeader
        title={account.accountName}
        subtitle="Who is in, who is off, and where your own leave stands."
      />

      <RangeSwitch range={range} basePath={basePath} className="mb-6" />

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
            {account.members.map((member) => (
              <MemberRow
                key={member.id}
                member={toMemberRow(
                  member,
                  // Their own day is the one page `assertCanViewUser` opens for
                  // them; everybody else's row is not a link.
                  member.id === viewer.id ? "/people" : null,
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
