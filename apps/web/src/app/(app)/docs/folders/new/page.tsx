import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@tpm/ui";
import { requireSession } from "@/lib/auth";
import { canCreateDocs, canCreateOrgDocs, canPlaceDoc, isSenior } from "@/lib/permissions";
import { listAccounts } from "@/queries/accounts";
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
  const [accounts, folderOptions] = await Promise.all([listAccounts(), listFolderOptions(user)]);
  const scoped = isSenior(user) ? accounts : accounts.filter((t) => user.accountIds.includes(t.id));
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
        accounts={scoped}
        parents={placeable.map((f) => ({ id: f.id, name: f.name }))}
        canPublishOrgWide={canCreateOrgDocs(user)}
        values={{
          name: "",
          // Default to the narrower of the two you are allowed, as elsewhere.
          visibility: user.accountIds.length > 0 ? "account" : "org",
          accountId: user.accountIds.length === 1 ? (user.accountIds[0] ?? "") : "",
          parentId: parent ?? "",
        }}
      />
    </>
  );
}
