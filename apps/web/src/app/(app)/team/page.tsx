import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { assertCanViewTeam } from "@/lib/permissions";
import { TeamTodayView } from "@/components/team-today-view";

export const dynamic = "force-dynamic";

/** An Account Director's own team. Senior Directors browse via /teams. */
export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireSession();
  if (!user.teamId) notFound();
  await assertCanViewTeam(user, user.teamId);

  const view = (await searchParams).view === "board" ? "board" : "list";
  return <TeamTodayView teamId={user.teamId} />;
}
