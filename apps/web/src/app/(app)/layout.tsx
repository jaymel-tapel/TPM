import { redirect } from "next/navigation";
import { demoSwitcherEnabled, getSession } from "@/lib/auth";
import { isSenior, navFor } from "@/lib/permissions";
import { listTeams } from "@/queries/team";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const links = navFor(session.user.role);

  /*
   * The Senior Director's Teams item expands to the teams themselves. They
   * come from the org chart that already exists — there is no way to add one
   * here, and nothing to configure. An Account Director has exactly one team
   * and it is already their Team item, so nothing expands for them.
   */
  if (isSenior(session.user)) {
    const teams = await listTeams();
    const item = links.find((l) => l.href === "/teams");
    if (item) {
      item.children = teams.map((t) => ({ href: `/teams/${t.id}`, label: t.name }));
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        links={links}
        user={{ name: session.user.name, role: session.user.role }}
        showRoleSwitcher={demoSwitcherEnabled}
      />
      {/* min-w-0 so a wide table inside can scroll instead of pushing the rail. */}
      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
