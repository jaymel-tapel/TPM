import { CampaignList, CampaignRow, PageHeader, SectionHeader } from "@tpm/ui";
import { openAccount } from "@/lib/account-page";
import { listCampaignsForAccount } from "@/queries/campaigns";
import { toCampaignRow } from "@/lib/present";
import { now } from "@/lib/date";

export const dynamic = "force-dynamic";

const GROUPS = [
  { status: "live" as const, title: "Running now", empty: "Nothing is running for this client." },
  { status: "planned" as const, title: "Booked", empty: "Nothing booked yet." },
  { status: "wrapped" as const, title: "Wrapped", empty: "Nothing has wrapped yet." },
];

/**
 * A client's campaigns.
 *
 * Grouped by where they are in their own life rather than sorted by date,
 * because "what is running" and "what is finished" are different questions and
 * one list ordered by start date answers neither at a glance.
 *
 * Campaigns stay a flat list inside the account. They do not appear in the
 * rail and they do not contain each other: a campaign gives a fortnight of
 * work a name and an end date, and anything deeper is the folder hierarchy the
 * brief refuses.
 */
export default async function AccountCampaignsPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { zone, account } = await openAccount(accountId);
  const reference = now(zone);
  const campaigns = await listCampaignsForAccount(accountId, reference, zone);

  return (
    <>
      <PageHeader
        eyebrow={account.name}
        title="Campaigns"
        subtitle="What this client has running, booked and behind them."
      />

      <div className="space-y-10">
        {GROUPS.map((group) => {
          const rows = campaigns.filter((c) => c.status === group.status);
          // A group with nothing in it is dropped rather than shown empty —
          // except Running, where "nothing is live" is worth saying out loud.
          if (rows.length === 0 && group.status !== "live") return null;
          return (
            <section key={group.status}>
              <SectionHeader aside={rows.length > 0 ? `${rows.length}` : undefined}>
                {group.title}
              </SectionHeader>
              <CampaignList empty={group.empty}>
                {rows.map((campaign) => (
                  <CampaignRow
                    key={campaign.id}
                    campaign={toCampaignRow(campaign, reference, zone)}
                  />
                ))}
              </CampaignList>
            </section>
          );
        })}
      </div>
    </>
  );
}
