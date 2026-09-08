import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { NavBar } from "@/components/nav-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <NavBar session={session} />
      <main className="px-8 py-10">{children}</main>
    </div>
  );
}
