import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { PageHeader } from "@meridian/ui";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { NewBoardForm } from "./new-board-form";

export const dynamic = "force-dynamic";

/**
 * A board belongs to a team, and an Account Director has exactly one, so there
 * is nothing to choose here beyond the name. The Senior Director creates
 * boards from the team they are looking at rather than from here.
 */
export default async function NewBoardPage() {
  const { user } = await requireSession();
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
      <NewBoardForm teamId={team.id} teamName={team.name} />
    </>
  );
}
