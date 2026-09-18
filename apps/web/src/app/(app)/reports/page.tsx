import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { Progress } from "@tpm/ui/primitives/progress";
import { TrendChart } from "@tpm/ui/chart";
import {
  Command,
  CommandBar,
  PageHeader,
  Panel,
  SectionHeader,
  Stat,
  TypeLabel,
  UserAvatar,
} from "@tpm/ui";
import { requireSession } from "@/lib/auth";

import { assertCanViewReports, isSenior } from "@/lib/permissions";
import {
  getCompletionByType,
  getCompletionTrend,
  getReportMetrics,
  getWorkload,
} from "@/queries/reports";
import { departmentScope, accountScope } from "@/queries/sql";
import { getAccountToday, listAccountsById } from "@/queries/accounts";

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
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const { user, zone } = await requireSession();
  await assertCanViewReports(user);

  const senior = isSenior(user);
  /*
   * A director used to have one account, so the report had nothing to choose.
   * Now they may carry three, and reporting on all of them at once would
   * average a good client with a struggling one into a number that describes
   * neither. So: one account at a time, named in the URL, defaulting to the
   * first. The `?account=` is checked against what they actually direct — it
   * arrives from the address bar, so it is a request rather than a fact.
   */
  const asked = (await searchParams).account;
  /*
   * Named first, chosen second: `listAccountsById` returns them in reading
   * order, so the default is the account whose tab sits leftmost. Taking
   * `directedIds[0]` instead defaulted to whatever order the lookup happened
   * to return, which lit up a tab in the middle of the row and read as a bug.
   */
  const accountOptions = senior ? [] : await listAccountsById(user.directedIds);
  const chosen =
    asked && user.directedIds.includes(asked) ? asked : accountOptions[0]?.id;
  if (!senior && !chosen) notFound();
  const scope = senior ? departmentScope : accountScope(chosen!);

  const [metrics, trend, byType, workload, account] = await Promise.all([
    getReportMetrics(scope, DAYS, undefined, zone),
    getCompletionTrend(scope, DAYS, undefined, zone),
    getCompletionByType(scope, DAYS, undefined, zone),
    getWorkload(scope, DAYS, undefined, zone),
    senior ? Promise.resolve(null) : getAccountToday(chosen!, undefined, zone),
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
        subtitle={`${senior ? "Across every account" : (account?.accountName ?? "Account")} · are we getting the work done consistently?`}
      />

      {/* Only when there is something to choose between. One account is not a
          switch, it is a label the title already carries. */}
      {accountOptions.length > 1 ? (
        <CommandBar className="mb-6">
          {accountOptions.map((option) => (
            <Command
              key={option.id}
              icon={Building2}
              href={`/reports?account=${option.id}`}
              active={option.id === chosen}
            >
              {option.name}
            </Command>
          ))}
        </CommandBar>
      ) : null}

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
                  key={row.type.slug}
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
                      <span className="ml-2 text-caption text-gray-600">{row.accountName}</span>
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
