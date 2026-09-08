import { redirect } from "next/navigation";
import { demoSwitcherEnabled, getSession } from "@/lib/auth";
import { isSenior, navFor } from "@/lib/permissions";
import { listTeams } from "@/queries/team";
import { listBoardsForUser } from "@/queries/tasks";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const links = navFor(session.user.role);

  /*
   * Rail groups are filled from the org chart, not configured: the Senior
   * Director's Teams item opens to the teams, and everyone else's Boards item
   * opens to the boards they can reach.
   */
  if (isSenior(session.user)) {
    const teams = await listTeams();
    const item = links.find((l) => l.href === "/teams");
    if (item) item.children = teams.map((t) => ({ href: `/teams/${t.id}`, label: t.name }));
  } else {
    const boards = await listBoardsForUser(session.user);
    const item = links.find((l) => l.href === "/boards");
    if (item) item.children = boards.map((b) => ({ href: `/boards/${b.id}`, label: b.name }));
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        links={links}
        user={{ name: session.user.name, role: session.user.role }}
        showRoleSwitcher={demoSwitcherEnabled}
        // Boards are the Account Director's to create, for their own team.
        canCreateBoard={session.user.role === "account_director"}
      />
      {/* min-w-0 so a wide table inside can scroll instead of pushing the rail. */}
      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
