import { redirect } from "next/navigation";
import { demoSwitcherEnabled, getSession } from "@/lib/auth";
import { accountNav, navFor, type NavAccount } from "@/lib/permissions";
import { railAccountsFor } from "@/queries/accounts";
import { getInbox, getUnreadCount } from "@/queries/notifications";
import { getUnreadTotal } from "@/queries/chat";
import { toInboxItem } from "@/lib/present";
import { realtimeEnabled } from "@/lib/realtime";
import { AppSidebar } from "@/components/app-sidebar";
import { RoleSwitcher } from "@/components/role-switcher";
import { RealtimeProvider } from "@/components/realtime-provider";
import { RefreshOnFocus } from "@/components/refresh-on-focus";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { before, after } = navFor(session.user.role);

  /*
   * Filled in here, not declared in `navFor` — that module runs no queries.
   * Ranked, not capped: the rail keeps the client you are currently inside
   * whether or not it is one of the busiest, and only the sidebar knows which
   * page you are on.
   */
  const rail = await railAccountsFor(session.user);
  const accounts: NavAccount[] = rail.map((account) => ({
    id: account.id,
    name: account.name,
    href: `/accounts/${account.id}`,
    children: accountNav(account.id),
  }));

  // The bell's contents come down with the page, like the rail's accounts — no
  // client fetch, and nothing reaches the browser that this render did not
  // already authorize.
  const [unread, inbox, chatUnread] = await Promise.all([
    getUnreadCount(session.user.id),
    getInbox(session.user.id, 8),
    getUnreadTotal(session.user.id),
  ]);

  // The rail's one badge. Chat keeps its own count rather than joining the
  // bell's: "Sarah said hi" and "you were assigned a task" are different
  // errands, and merging them would stop the inbox being the place for things
  // that need doing.
  const chat = after.find((l) => l.href === "/chat");
  if (chat) chat.count = chatUnread;

  return (
    <div className="flex min-h-screen bg-background">
      <RealtimeProvider enabled={realtimeEnabled} />
      <RefreshOnFocus />
      <AppSidebar
        before={before}
        accounts={accounts}
        after={after}
        user={{ name: session.user.name, role: session.user.role }}
        notifications={inbox.map((entry) => toInboxItem(entry))}
        unread={unread}
      />
      {/* min-w-0 so a wide table inside can scroll instead of pushing the rail. */}
      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
      {demoSwitcherEnabled ? <RoleSwitcher currentRole={session.user.role} /> : null}
    </div>
  );
}
