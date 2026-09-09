import {
  LeaveRequestList,
  LeaveRequestRow,
  MemberList,
  MemberRow,
  PageHeader,
  SectionHeader,
} from "@meridian/ui";
import { openAccount } from "@/lib/account-page";
import { canViewAccount } from "@/lib/permissions";
import { getAccountToday } from "@/queries/accounts";
import { listAccountLeave, listPendingFor } from "@/queries/leave";
import { toLeaveRequest, toMemberRow } from "@/lib/present";
import { LeaveDecision } from "@/components/leave-buttons";
import { RangeSwitch } from "@/components/range-switch";
import { RANGE_DAYS, RANGE_LABEL, parseRange } from "@/lib/range";
import { addDays, dayKey } from "@/lib/leave";
import { now } from "@/lib/date";

export const dynamic = "force-dynamic";

/** How far ahead the leave list looks. A fortnight is as far as a rota is real. */
const LEAVE_HORIZON_DAYS = 14;

/**
 * Who works on this client.
 *
 * A person appears on every account they work on, which is the point — Anna is
 * on this page for Volvo and again for MG, and her numbers are the same on
 * both because they are her day's, not the account's slice of it.
 *
 * Everyone servicing the account reads the same rows: an account's workload is
 * the account's own business. What stays behind `canViewAccount` is the right
 * to open somebody's day and the queue of leave decisions — so for everybody
 * else the rows are not links.
 */
export default async function AccountTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { accountId } = await params;
  const { user, zone, account } = await openAccount(accountId);
  const range = parseRange((await searchParams).range);
  const reference = now(zone);
  const today = dayKey(reference, zone);
  const manages = canViewAccount(user, accountId);

  const [rollup, upcoming, pending] = await Promise.all([
    getAccountToday(accountId, undefined, zone, RANGE_DAYS[range]),
    // Who is out today is already on the member rows, so this is only the
    // fortnight ahead — saying it twice on one screen would be noise.
    listAccountLeave(user, accountId, addDays(today, 1), addDays(today, LEAVE_HORIZON_DAYS)),
    manages ? listPendingFor(user) : Promise.resolve([]),
  ]);
  if (!rollup) return null;

  const away = rollup.members.filter((m) => m.away);

  return (
    <>
      <PageHeader
        eyebrow={account.name}
        title="Team"
        subtitle="Everyone working on this client, and what they are carrying."
      />

      <RangeSwitch range={range} basePath={`/accounts/${accountId}/team`} className="mb-6" />

      <div className="space-y-10">
        <section>
          <SectionHeader
            aside={away.length === 0 ? "Everyone is in" : `${away.length} away`}
          >
            {RANGE_LABEL[range]}
          </SectionHeader>
          <MemberList>
            {rollup.members.map((member) => (
              <MemberRow
                key={member.id}
                member={toMemberRow(
                  member,
                  // Their own day is the one page `assertCanViewUser` opens for
                  // a team member; a director may open anybody's on the account.
                  manages || member.id === user.id ? "/people" : null,
                  reference,
                  zone,
                )}
              />
            ))}
          </MemberList>
        </section>

        <section>
          <SectionHeader>Coming up</SectionHeader>
          <LeaveRequestList empty="Nobody here is booked off in the next fortnight.">
            {upcoming.map((row) => (
              <LeaveRequestRow key={row.id} request={toLeaveRequest(row, user, reference, zone)} />
            ))}
          </LeaveRequestList>
        </section>

        {manages && pending.length > 0 ? (
          <section>
            <SectionHeader aside={`${pending.length} awaiting you`}>Leave requests</SectionHeader>
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
