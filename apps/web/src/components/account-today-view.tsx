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
} from "@tpm/ui";
import { Progress } from "@tpm/ui/primitives/progress";
import type { Zone } from "@/lib/date";
import { getAccountToday } from "@/queries/accounts";
import { getBoardView } from "@/queries/tasks";
import { toBoard } from "@/lib/present";
import { setTaskStatus } from "@/actions/tasks";
import { getNeedsAttention } from "@/queries/attention";
import { accountScope } from "@/queries/sql";
import { toLeaveRequest, toMemberRow } from "@/lib/present";
import { listPendingFor, listAccountLeave } from "@/queries/leave";
import { addDays, dayKey } from "@/lib/leave";
import { now } from "@/lib/date";
import type { User } from "@/db/schema";
import type { Viewer } from "@/lib/auth";
import { LeaveDecision } from "@/components/leave-buttons";
import { RangeSwitch } from "@/components/range-switch";
import { RANGE_DAYS, RANGE_METRIC_LABEL, type RangeKind } from "@/lib/range";

/** How far ahead the leave list looks. A fortnight is as far as a rota is real. */
const LEAVE_HORIZON_DAYS = 14;

/**
 * Screen 3. The Account Director should understand the account in seconds: one
 * headline number, one line per person, then what needs them.
 */
export async function AccountTodayView({
  viewer,
  accountId,
  zone,
  showAccountName = false,
  range,
  basePath,
}: {
  /** Whose queue the Leave section shows. */
  viewer: Viewer;
  accountId: string;
  /** The reader's timezone — an account's "today" is reckoned by whoever opens it. */
  zone?: Zone;
  /**
   * The Account Director has one account and the rail already says so, so their
   * screen goes straight to the numbers. A Senior Director is looking at one
   * of several, and a page about an account should say which.
   */
  showAccountName?: boolean;
  range: RangeKind;
  /** Where the day/week links point — the AD's own account, or an account the Senior
   *  Director picked. */
  basePath: string;
}) {
  const reference = now(zone);
  const today = dayKey(reference, zone);

  const [account, attention, pending, upcoming] = await Promise.all([
    getAccountToday(accountId, undefined, zone, RANGE_DAYS[range]),
    getNeedsAttention(accountScope(accountId), undefined, zone),
    listPendingFor(viewer),
    // Who is out today is already on the member rows, so this is only the
    // fortnight ahead — saying it twice on one screen would be noise.
    listAccountLeave(viewer, accountId, addDays(today, 1), addDays(today, LEAVE_HORIZON_DAYS)),
  ]);
  if (!account) notFound();

  return (
    <div className="space-y-10">
      {showAccountName ? (
        <h1 className="text-title-1 text-gray-1000">{account.accountName}</h1>
      ) : null}

      <RangeSwitch range={range} basePath={basePath} />

      <Panel className="p-8">
        <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
          <Stat
            value={<Percent value={account.percent} />}
            label={RANGE_METRIC_LABEL[range]}
            size="xl"
          />
          <dl className="flex flex-wrap gap-x-12 gap-y-4 sm:ml-auto">
            <Stat value={account.headcount} label="People" size="sm" />
            <Stat value={account.due} label="Tasks due" size="sm" />
            <Stat value={account.done} label="Completed" size="sm" />
            <Stat
              value={account.overdue}
              label="Overdue"
              size="sm"
              tone={account.overdue > 0 ? "danger" : "default"}
            />
          </dl>
        </div>
        <Progress value={account.percent} className="mt-8 h-1.5" />
      </Panel>

      <section>
          <SectionHeader aside="Click a person to open their day">Team Members</SectionHeader>
          <MemberList>
            {account.members.map((member) => (
              <MemberRow
                key={member.id}
                member={toMemberRow(member, "/people", reference, zone)}
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
