import { redirect } from "next/navigation";
import { demoSwitcherEnabled, getSession } from "@/lib/auth";
import { isSenior, navFor, type NavChild } from "@/lib/permissions";
import { listAccounts } from "@/queries/accounts";
import { listBoardsForUser } from "@/queries/tasks";
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

  const links = navFor(session.user.role);

  /*
   * Rail groups are filled from the org chart, not configured: the Accounts item
   * opens to the accounts, and the Boards item to the boards that person can
   * reach. The Senior Director gets both — every account, and every account's work.
   */
  if (isSenior(session.user)) {
    const accounts = await listAccounts();
    const item = links.find((l) => l.href === "/accounts");
    if (item) item.children = accounts.map((t) => ({ href: `/accounts/${t.id}`, label: t.name }));
  }

  {
    const boards = await listBoardsForUser(session.user);
    const item = links.find((l) => l.href === "/boards");
    if (item) {
      if (isSenior(session.user)) {
        /*
         * Grouped by account, because the Senior Director is the one person who
         * sees every account's boards at once and a flat list of them is a list
         * you read rather than scan. The department's own boards have no account
         * to sit under, so they sit at the top where they belong.
         */
        const byAccount = new Map<string, { name: string; children: NavChild[] }>();
        const department: NavChild[] = [];

        for (const board of boards) {
          const row = { href: `/boards/${board.id}`, label: board.name };
          if (!board.accountId) {
            department.push(row);
            continue;
          }
          const group = byAccount.get(board.accountId);
          if (group) group.children.push(row);
          else byAccount.set(board.accountId, { name: board.accountName ?? "Account", children: [row] });
        }

        item.children = [
          ...department,
          ...[...byAccount.values()].map((t) => ({ label: t.name, children: t.children })),
        ];
      } else {
        item.children = boards.map((b) => ({
          href: `/boards/${b.id}`,
          label: b.name,
          // The department's own boards sit alongside their account's, and a
          // person should be able to tell which is which.
          note: b.accountId ? undefined : "Department",
        }));
      }
    }
  }

  // The bell's contents come down with the page, like the rail's boards — no
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
  const chat = links.find((l) => l.href === "/chat");
  if (chat) chat.count = chatUnread;

  return (
    <div className="flex min-h-screen bg-background">
      <RealtimeProvider enabled={realtimeEnabled} />
      <RefreshOnFocus />
      <AppSidebar
        links={links}
        user={{ name: session.user.name, role: session.user.role }}
        // Boards are the Account Director's to create, for their own account.
        canCreateBoard={session.user.role === "account_director" || isSenior(session.user)}
        notifications={inbox.map((entry) => toInboxItem(entry))}
        unread={unread}
      />
      {/* min-w-0 so a wide table inside can scroll instead of pushing the rail. */}
      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
      {demoSwitcherEnabled ? <RoleSwitcher currentRole={session.user.role} /> : null}
    </div>
  );
}
