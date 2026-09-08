import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { canCreateDocs, canCreateOrgDocs, isSenior } from "@/lib/permissions";
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
  // A director writes for their own team; the Senior Director picks.
  const scoped = isSenior(user) ? teams : teams.filter((t) => t.id === user.teamId);

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
        parents={parents.map((p) => ({ id: p.id, title: p.title }))}
        canPublishOrgWide={canCreateOrgDocs(user)}
        values={{
          title: "",
          body: "",
          visibility: canCreateOrgDocs(user) ? "org" : "team",
          teamId: user.teamId ?? scoped[0]?.id ?? "",
          parentId: parent ?? "",
        }}
      />
    </>
  );
}
