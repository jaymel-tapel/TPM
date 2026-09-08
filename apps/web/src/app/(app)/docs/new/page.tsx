import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { canCreateDocs, canCreateOrgDocs, canPlaceDoc, isSenior } from "@/lib/permissions";
import { listTeams } from "@/queries/team";
import { listFolderOptions } from "@/queries/docs";
import { createDoc } from "@/actions/docs";
import { DocForm } from "@/components/doc-form";

export const dynamic = "force-dynamic";

export default async function NewDocPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { user } = await requireSession();
  if (!canCreateDocs(user)) notFound();

  const { folder } = await searchParams;
  const [teams, folderOptions] = await Promise.all([listTeams(), listFolderOptions(user)]);
  // Everyone below the Senior Director writes for their own team, so there is
  // nothing to pick between.
  const scoped = isSenior(user) ? teams : teams.filter((t: { id: string }) => t.id === user.teamId);
  // A document takes its folder's scope, so only offer folders this person is
  // allowed to write in.
  const placeable = folderOptions.filter((f) => canPlaceDoc(user, f));

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
        folders={placeable.map((f) => ({ id: f.id, name: f.name }))}
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
          folderId: folder ?? "",
        }}
      />
    </>
  );
}
