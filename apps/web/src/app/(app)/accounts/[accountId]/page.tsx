import Link from "next/link";
import {
  CampaignList,
  CampaignRow,
  NeedsAttention,
  PageHeader,
  Panel,
  Percent,
  SectionHeader,
  Stat,
} from "@tpm/ui";
import { Progress } from "@tpm/ui/primitives/progress";
import { openAccount } from "@/lib/account-page";
import { canViewAccount } from "@/lib/permissions";
import { getAccountToday } from "@/queries/accounts";
import { listCampaignsForAccount } from "@/queries/campaigns";
import { getNeedsAttention } from "@/queries/attention";
import { accountScope } from "@/queries/sql";
import { toAttentionItem, toCampaignRow } from "@/lib/present";
import { RangeSwitch } from "@/components/range-switch";
import { RANGE_DAYS, RANGE_METRIC_LABEL, parseRange } from "@/lib/range";
import { now } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * What is happening with this client right now.
 *
 * Deliberately not a dashboard: one headline, four counts, the campaigns that
 * are actually running, and — for whoever is answerable — what needs them. The
 * roster moved to its own page, because "how is the account" and "who is on
 * it" are different questions and answering both here made neither land.
 */
export default async function AccountOverviewPage({
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

  /*
   * Needs Attention stays behind `canViewAccount` — it is the management
   * screen, the same way the department headline and the leave queue are. The
   * numbers above it are not: an account's workload is the account's own
   * business and everyone servicing it reads the same figures.
   */
  const manages = canViewAccount(user, accountId);

  const [today, campaigns, attention] = await Promise.all([
    getAccountToday(accountId, undefined, zone, RANGE_DAYS[range]),
    listCampaignsForAccount(accountId, reference, zone),
    manages ? getNeedsAttention(accountScope(accountId), undefined, zone) : Promise.resolve([]),
  ]);
  if (!today) return null;

  /*
   * Running first, then booked. A wrapped campaign is history and belongs on
   * the Campaigns page rather than at the top of the overview — and ordering by
   * start date alone put a campaign that has not begun above the one everybody
   * is actually working on.
   */
  const active = campaigns
    .filter((c) => c.status !== "wrapped")
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "live" ? -1 : 1))
    .slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow={account.name}
        title="Overview"
        subtitle={
          account.directorName
            ? `Account Director · ${account.directorName}`
            : "No Account Director"
        }
      />

      <RangeSwitch range={range} basePath={`/accounts/${accountId}`} className="mb-6" />

      <div className="space-y-10">
        <Panel className="p-8">
          <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
            <Stat
              value={<Percent value={today.percent} />}
              label={RANGE_METRIC_LABEL[range]}
              size="xl"
            />
            <dl className="flex flex-wrap gap-x-12 gap-y-4 sm:ml-auto">
              <Stat value={today.headcount} label="People" size="sm" />
              <Stat value={today.due} label="Tasks due" size="sm" />
              <Stat value={today.done} label="Completed" size="sm" />
              <Stat
                value={today.overdue}
                label="Overdue"
                size="sm"
                tone={today.overdue > 0 ? "danger" : "default"}
              />
              <Stat
                value={today.blocked}
                label="Blocked"
                size="sm"
                tone={today.blocked > 0 ? "danger" : "default"}
              />
            </dl>
          </div>
          <Progress value={today.percent} className="mt-8 h-1.5" />
        </Panel>

        <section>
          <SectionHeader
            aside={
              <Link
                href={`/accounts/${accountId}/campaigns`}
                className="text-body-strong text-blue-700 hover:text-blue-800"
              >
                All campaigns →
              </Link>
            }
          >
            Active campaigns
          </SectionHeader>
          <CampaignList empty="Nothing running for this client right now.">
            {active.map((campaign) => (
              <CampaignRow key={campaign.id} campaign={toCampaignRow(campaign, reference, zone)} />
            ))}
          </CampaignList>
        </section>

        {manages ? (
          <section>
            <SectionHeader>Needs attention</SectionHeader>
            <NeedsAttention items={attention.map(toAttentionItem)} />
          </section>
        ) : null}
      </div>
    </>
  );
}
