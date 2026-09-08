import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { canCreateDocs, canCreateOrgDocs, canPlaceDoc, isSenior } from "@/lib/permissions";
import { listTeams } from "@/queries/team";
import { listDocParentOptions } from "@/queries/docs";
import { createDoc } from "@/actions/docs";
import { DocForm } from "@/components/doc-form";

export const dynamic = "force-dynamic";

export default async function NewDocPage({
  searchParams,
}: {
  searchParams: Promise<{ parent?: string }>;
}) {
  const { user } = await requireSession();
  if (!canCreateDocs(user)) notFound();

  const { parent } = await searchParams;
  const [teams, parents] = await Promise.all([listTeams(), listDocParentOptions(user)]);
  // Everyone below the Senior Director writes for their own team, so there is
  // nothing to pick between.
  const scoped = isSenior(user) ? teams : teams.filter((t) => t.id === user.teamId);
  // Filing under a document adopts its scope, so only offer parents whose
  // scope this person is allowed to write in.
  const placeable = parents.filter((p) => canPlaceDoc(user, p));

  return (
    <>
      <PageHeader
        title="New document"
        subtitle="Reference material a task can point at."
        aside={
          <Link href="/docs" className="text-body-strong text-blue-700 hover:text-blue-800">
            ← Back to docs
          </Link>
        }
      />
      <DocForm
        action={createDoc}
        submitLabel="Create document"
        teams={scoped}
        parents={placeable.map((p) => ({ id: p.id, title: p.title }))}
        canPublishOrgWide={canCreateOrgDocs(user)}
        values={{
          title: "",
          body: "",
          /*
           * Default to the narrower of the two you are allowed. An Account
           * Director may now publish to the department, but most of what they
           * write is for their own team, and the wider setting is the one that
           * should take a deliberate act rather than a default.
           */
          visibility: user.teamId ? "team" : "org",
          teamId: user.teamId ?? scoped[0]?.id ?? "",
          parentId: parent ?? "",
        }}
      />
    </>
  );
}
