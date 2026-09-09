import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { canCreateDocs, canCreateOrgDocs, canPlaceDoc, isSenior } from "@/lib/permissions";
import { listAccounts } from "@/queries/accounts";
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
  const [accounts, folderOptions] = await Promise.all([listAccounts(), listFolderOptions(user)]);
  // Everyone below the Senior Director writes for their own account, so there is
  // nothing to pick between.
  const scoped = isSenior(user) ? accounts : accounts.filter((t: { id: string }) => user.accountIds.includes(t.id));
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
        accounts={scoped}
        folders={placeable.map((f) => ({ id: f.id, name: f.name }))}
        canPublishOrgWide={canCreateOrgDocs(user)}
        values={{
          title: "",
          body: "",
          /*
           * Default to the narrower of the two you are allowed. An Account
           * Director may now publish to the department, but most of what they
           * write is for their own account, and the wider setting is the one that
           * should take a deliberate act rather than a default.
           */
          visibility: user.accountIds.length > 0 ? "account" : "org",
          accountId: user.accountIds.length === 1 ? (user.accountIds[0] ?? "") : "",
          folderId: folder ?? "",
        }}
      />
    </>
  );
}
