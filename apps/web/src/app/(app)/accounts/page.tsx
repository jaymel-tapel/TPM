import {
  CompareList,
  DeltaBadge,
  Eyebrow,
  HeroPanel,
  LeaveRequestList,
  LeaveRequestRow,
  NeedsAttention,
  PageHeader,
  Percent,
  SectionHeader,
  Stat,
  TrendStrip,
} from "@meridian/ui";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { isSenior } from "@/lib/permissions";
import { getDepartmentToday } from "@/queries/department";
import { getDepartmentAttention, getNeedsAttention } from "@/queries/attention";
import { getCompletionTrend } from "@/queries/reports";
import { departmentScope } from "@/queries/sql";
import { listPendingFor } from "@/queries/leave";
import { toAttentionItem, toLeaveRequest } from "@/lib/present";
import { LeaveDecision } from "@/components/leave-buttons";
import { fmtLongDate, now } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * Every client, on one axis.
 *
 * This absorbed the department Overview, which was a second screen answering
 * the same question with the same rows — "how are the accounts doing" — one
 * page up. What only the Overview had was the department's own hero and the
 * exceptions list, and those are the Senior Director's, so they sit on top of
 * this for that reader and nowhere else.
 *
 * The rows are the same component for all three roles; how many there are is
 * what differs. A designer on two clients sees two, and the question is still
 * the one they came with: which of mine needs me today.
 */
export default async function AccountsPage() {
  const { user, zone } = await requireSession();
  const senior = isSenior(user);
  if (!senior && user.accountIds.length === 0) notFound();

  const reference = now(zone);
  const [dept, trend, deptSignals, generalSignals, pending] = await Promise.all([
    getDepartmentToday(undefined, zone, senior ? undefined : user.accountIds),
    senior
      ? getCompletionTrend(departmentScope, 7, undefined, zone)
      : Promise.resolve([]),
    senior ? getDepartmentAttention(undefined, zone) : Promise.resolve([]),
    senior ? getNeedsAttention(departmentScope, undefined, zone) : Promise.resolve([]),
    // Whose leave is waiting on this reader. Empty for a team member, which is
    // what makes the section disappear rather than show an empty box.
    listPendingFor(user),
  ]);

  // Department-level patterns first, then the individual exceptions.
  const attention = [...deptSignals, ...generalSignals].slice(0, 4).map(toAttentionItem);
  const deptDelta = dept.weekPercent - dept.priorWeekPercent;

  const rows = dept.accounts.map((account) => ({
    id: account.id,
    href: `/accounts/${account.id}`,
    name: account.name,
    note: account.directorName,
    avatarName: account.directorName,
    percent: account.percent,
    overdue: account.overdue,
    delta: account.weekPercent - account.priorWeekPercent,
  }));

  return (
    <div className="space-y-10">
      {senior ? (
        <HeroPanel>
          <div className="flex items-baseline justify-between gap-4">
            <Eyebrow tone="onDark">Department Today</Eyebrow>
            <span className="text-caption text-white/45">{fmtLongDate(reference, zone)}</span>
          </div>

          {/* Two columns: where we stand on the left, which way we are going on
              the right. One glance answers both. */}
          <div className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <div>
              <p className="tabular text-display text-amber-500">
                <Percent value={dept.percent} muted={false} />
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="text-body-lg text-white/70">Completion rate today</p>
                <DeltaBadge value={deptDelta} tone="dark" />
              </div>

              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
                <Stat value={dept.headcount} label="People" size="sm" tone="onDark" />
                <Stat value={dept.due} label="Tasks due" size="sm" tone="onDark" />
                <Stat value={dept.done} label="Completed" size="sm" tone="onDark" />
                <Stat value={dept.overdue} label="Overdue" size="sm" tone="onDark" />
              </dl>
            </div>

            <div className="lg:border-l lg:border-white/10 lg:pl-12">
              <Eyebrow tone="onDark" className="mb-6">
                Last 7 days
              </Eyebrow>
              <TrendStrip data={trend} tone="dark" />
            </div>
          </div>
        </HeroPanel>
      ) : (
        <PageHeader
          eyebrow={fmtLongDate(reference, zone)}
          title="Your accounts"
          subtitle="The clients you work on, and how each is doing today."
        />
      )}

      <section>
        <SectionHeader aside={`${rows.length} ${rows.length === 1 ? "account" : "accounts"}`}>
          {senior ? "Accounts" : "Today"}
        </SectionHeader>
        <CompareList rows={rows} />
      </section>

      {senior ? (
        <section>
          <SectionHeader>Needs Attention</SectionHeader>
          <NeedsAttention items={attention} />
        </section>
      ) : null}

      {pending.length > 0 ? (
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
  );
}
