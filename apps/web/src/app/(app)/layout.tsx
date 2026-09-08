import { redirect } from "next/navigation";
import { demoSwitcherEnabled, getSession } from "@/lib/auth";
import { navFor } from "@/lib/permissions";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        links={navFor(session.user.role)}
        user={{ name: session.user.name, role: session.user.role }}
        showRoleSwitcher={demoSwitcherEnabled}
      />
      {/* min-w-0 so a wide table inside can scroll instead of pushing the rail. */}
      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
