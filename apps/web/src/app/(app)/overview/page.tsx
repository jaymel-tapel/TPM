import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DeltaBadge,
  Eyebrow,
  HeroPanel,
  NeedsAttention,
  Percent,
  SectionHeader,
  Stat,
  TeamCompare,
  TrendStrip,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { assertCanViewReports, isSenior } from "@/lib/permissions";
import { getDepartmentToday } from "@/queries/department";
import { getDepartmentAttention, getNeedsAttention } from "@/queries/attention";
import { getCompletionTrend } from "@/queries/reports";
import { departmentScope } from "@/queries/sql";
import { fmtLongDate, now } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * Screen 4. Not a bigger team dashboard. It answers the Senior Director's
 * three questions in order: where does the department stand, how do the two
 * teams compare, and what needs me.
 */
export default async function OverviewPage() {
  const { user, zone } = await requireSession();
  await assertCanViewReports(user);
  if (!isSenior(user)) notFound();

  const [dept, trend, deptSignals, generalSignals] = await Promise.all([
    getDepartmentToday(undefined, zone),
    getCompletionTrend(departmentScope, 7, undefined, zone),
    getDepartmentAttention(undefined, zone),
    getNeedsAttention(departmentScope, undefined, zone),
  ]);

  // Department-level patterns first, then the individual exceptions.
  const attention = [...deptSignals, ...generalSignals].slice(0, 4);
  const deptDelta = dept.weekPercent - dept.priorWeekPercent;

  return (
    <div className="space-y-10">
      <HeroPanel>
        <div className="flex items-baseline justify-between gap-4">
          <Eyebrow tone="onDark">Department Today</Eyebrow>
          <span className="text-caption text-white/45">{fmtLongDate(now(zone), zone)}</span>
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

      <section>
        <SectionHeader
          aside={
            <Link href="/teams" className="text-body-strong text-blue-700 hover:text-blue-800">
              Open teams →
            </Link>
          }
        >
          Teams
        </SectionHeader>
        <TeamCompare
          teams={dept.teams.map((team) => ({
            id: team.id,
            href: `/teams/${team.id}`,
            name: team.name,
            directorName: team.directorName,
            percent: team.percent,
            overdue: team.overdue,
            delta: team.weekPercent - team.priorWeekPercent,
          }))}
        />
      </section>

      <section>
        <SectionHeader>Needs Attention</SectionHeader>
        <NeedsAttention items={attention} />
      </section>
    </div>
  );
}
