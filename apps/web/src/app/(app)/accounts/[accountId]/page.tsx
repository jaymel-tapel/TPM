import { requireSession } from "@/lib/auth";
import { assertCanViewAccountWork, canViewAccount } from "@/lib/permissions";
import { AccountTodayView } from "@/components/account-today-view";
import { AccountAvailabilityView } from "@/components/account-availability-view";
import { parseRange } from "@/lib/range";

export const dynamic = "force-dynamic";

/**
 * An account.
 *
 * One route, two screens, because the two readers are asking different
 * questions of the same client. The door opens for anyone on the account,
 * which is `canViewAccountWork`'s rule and the same one its board follows;
 * `canViewAccount` then decides *which* screen, rather than whether there is
 * one at all.
 *
 * Both screens report the same per-person numbers: an account's workload is
 * the account's own business, and everyone servicing it reads the same roster.
 * What stays behind `canViewAccount` is the management screen around them —
 * the headline, the exceptions, the approval queue — and the right to open a
 * colleague's day, which is why a member's roster rows are not links.
 */
export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { accountId } = await params;
  const { user, zone } = await requireSession();
  await assertCanViewAccountWork(user, accountId);

  // The window lives in the URL so it survives a reload and can be sent on.
  const range = parseRange((await searchParams).range);
  const basePath = `/accounts/${accountId}`;

  return canViewAccount(user, accountId) ? (
    <AccountTodayView
      viewer={user}
      accountId={accountId}
      zone={zone}
      showAccountName
      range={range}
      basePath={basePath}
    />
  ) : (
    <AccountAvailabilityView
      viewer={user}
      accountId={accountId}
      zone={zone}
      range={range}
      basePath={basePath}
    />
  );
}
