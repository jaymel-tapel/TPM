import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { canCreateDocs, canCreateOrgDocs, canPlaceDoc, isSenior } from "@/lib/permissions";
import { listTeams } from "@/queries/team";
import { listFolderOptions } from "@/queries/docs";
import { createFolder } from "@/actions/docs";
import { FolderForm } from "@/components/folder-form";

export const dynamic = "force-dynamic";

export default async function NewFolderPage({
  searchParams,
}: {
  searchParams: Promise<{ parent?: string }>;
}) {
  const { user } = await requireSession();
  if (!canCreateDocs(user)) notFound();

  const { parent } = await searchParams;
  const [teams, folderOptions] = await Promise.all([listTeams(), listFolderOptions(user)]);
  const scoped = isSenior(user) ? teams : teams.filter((t) => t.id === user.teamId);
  const placeable = folderOptions.filter((f) => canPlaceDoc(user, f));

  return (
    <>
      <PageHeader
        title="New folder"
        subtitle="A place to keep documents together."
        aside={
          <Link href="/docs" className="text-body-strong text-blue-700 hover:text-blue-800">
            ← Back to docs
          </Link>
        }
      />
      <FolderForm
        action={createFolder}
        submitLabel="Create folder"
        teams={scoped}
        parents={placeable.map((f) => ({ id: f.id, name: f.name }))}
        canPublishOrgWide={canCreateOrgDocs(user)}
        values={{
          name: "",
          // Default to the narrower of the two you are allowed, as elsewhere.
          visibility: user.teamId ? "team" : "org",
          teamId: user.teamId ?? scoped[0]?.id ?? "",
          parentId: parent ?? "",
        }}
      />
    </>
  );
}
