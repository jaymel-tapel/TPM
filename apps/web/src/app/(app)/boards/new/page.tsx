import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { PageHeader } from "@meridian/ui";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { isSenior } from "@/lib/permissions";
import { listTeams } from "@/queries/team";
import { NewBoardForm } from "./new-board-form";

export const dynamic = "force-dynamic";

/**
 * An Account Director has exactly one team, so there is nothing to choose here
 * beyond the name. The Senior Director spans both, and can also file a board
 * under no team at all — the department's own work, which belongs to nobody
 * and so to everybody.
 */
export default async function NewBoardPage() {
  const { user } = await requireSession();

  if (isSenior(user)) {
    const all = await listTeams();
    return (
      <>
        <PageHeader
          title="New board"
          subtitle="A place for work to live. You can add columns once it exists."
        />
        <NewBoardForm teams={all.map((t) => ({ id: t.id, name: t.name }))} />
      </>
    );
  }

  if (user.role !== "account_director" || !user.teamId) notFound();
  const team = await db.query.teams.findFirst({ where: eq(teams.id, user.teamId) });
  if (!team) notFound();

  return (
    <>
      <PageHeader
        eyebrow={team.name}
        title="New board"
        subtitle="A place for work to live. You can add columns once it exists."
      />
      <NewBoardForm teams={[]} fixedTeam={{ id: team.id, name: team.name }} />
    </>
  );
}
