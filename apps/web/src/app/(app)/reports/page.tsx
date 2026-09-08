import { notFound } from "next/navigation";
import { Progress } from "@meridian/ui/primitives/progress";
import { TrendChart } from "@meridian/ui/chart";
import {
  PageHeader,
  Panel,
  SectionHeader,
  Stat,
  TypeLabel,
  UserAvatar,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { assertCanViewReports, isSenior } from "@/lib/permissions";
import {
  getCompletionByType,
  getCompletionTrend,
  getReportMetrics,
  getWorkload,
} from "@/queries/reports";
import { departmentScope, teamScope } from "@/queries/sql";
import { getTeamToday } from "@/queries/team";

export const dynamic = "force-dynamic";

const DAYS = 7;

function duration(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

/**
 * Screen 5. Only the metrics that answer "are we getting the work done
 * consistently?" — and exactly one chart.
 */
export default async function ReportsPage() {
  const { user } = await requireSession();
  await assertCanViewReports(user);

  const senior = isSenior(user);
  if (!senior && !user.teamId) notFound();
  const scope = senior ? departmentScope : teamScope(user.teamId!);

  const [metrics, trend, byType, workload, team] = await Promise.all([
    getReportMetrics(scope, DAYS),
    getCompletionTrend(scope, DAYS),
    getCompletionByType(scope, DAYS),
    getWorkload(scope, DAYS),
    senior ? Promise.resolve(null) : getTeamToday(user.teamId!),
  ]);

  const headline = [
    { label: "Tasks due", value: metrics.due },
    { label: "Completed", value: metrics.completed },
    { label: "Completion rate", value: `${metrics.completionRate}%`, lead: true },
    { label: "Completed on time", value: `${metrics.onTimeRate}%` },
    { label: "Overdue", value: metrics.overdue, warn: metrics.overdue > 0 },
    { label: "Avg completion time", value: duration(metrics.avgCompletionHours) },
  ];

  return (
    <>
      <PageHeader
        eyebrow={`Last ${DAYS} days`}
        title="Report"
        subtitle={`${senior ? "Across both teams" : (team?.teamName ?? "Team")} · are we getting the work done consistently?`}
      />

      <div className="space-y-10">
        <Panel className="p-8">
          <dl className="grid gap-x-8 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {headline.map((m) => (
              <Stat
                key={m.label}
                value={m.value}
                label={m.label}
                size={m.lead ? "lg" : "md"}
                tone={m.warn ? "danger" : "default"}
              />
            ))}
          </dl>
        </Panel>

        <section>
          <SectionHeader aside="Tasks due that day, completed by end of day">
            Daily completion
          </SectionHeader>
          <Panel className="p-6">
            <TrendChart data={trend} />
          </Panel>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <SectionHeader>Completion by task type</SectionHeader>
            <Panel className="divide-y divide-gray-300 px-6">
              {byType.map((row) => (
                <div
                  key={row.type}
                  className="grid grid-cols-[minmax(0,1fr)_96px_48px] items-center gap-4 py-3"
                >
                  <TypeLabel type={row.type} className="truncate text-body-strong text-gray-1000" />
                  <Progress value={row.percent} className="h-1.5" />
                  <span className="tabular text-right text-body-strong text-gray-1000">
                    {row.percent}%
                  </span>
                </div>
              ))}
            </Panel>
          </section>

          <section>
            <SectionHeader aside="Busiest first">Workload per person</SectionHeader>
            <Panel className="divide-y divide-gray-300 px-6">
              {workload.slice(0, 8).map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto_48px] items-center gap-3 py-2.5"
                >
                  <UserAvatar name={row.name} size="sm" />
                  <span className="min-w-0 truncate text-body-strong text-gray-1000">
                    {row.name}
                    {senior ? (
                      <span className="ml-2 text-caption text-gray-600">{row.teamName}</span>
                    ) : null}
                  </span>
                  <span className="tabular whitespace-nowrap text-caption text-gray-600">
                    {row.done} / {row.due}
                  </span>
                  <span className="tabular text-right text-body-strong text-gray-1000">
                    {row.percent}%
                  </span>
                </div>
              ))}
            </Panel>
          </section>
        </div>
      </div>
    </>
  );
}
