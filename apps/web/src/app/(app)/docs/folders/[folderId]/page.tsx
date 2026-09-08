import { notFound } from "next/navigation";
import { FilePlus, FolderPlus, Pencil, X } from "lucide-react";
import {
  Command,
  CommandBar,
  CommandDivider,
  DocBreadcrumb,
  DocTree,
  PageHeader,
  ScopeBadge,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { canCreateOrgDocs, canEditDoc, canPlaceDoc, isSenior } from "@/lib/permissions";
import { listTeams } from "@/queries/team";
import { getFolder, listFolderContents, listFolderOptions } from "@/queries/docs";
import { toDocFolderRow, toDocNode } from "@/lib/present";
import { deleteFolder, updateFolder } from "@/actions/docs";
import { FolderForm } from "@/components/folder-form";

export const dynamic = "force-dynamic";

/**
 * What is in a folder. Like a document, it opens as something to look at —
 * renaming or moving it is a verb you reach for.
 */
export default async function FolderPage({
  params,
  searchParams,
}: {
  params: Promise<{ folderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { folderId } = await params;
  const { user } = await requireSession();

  const folder = await getFolder(user, folderId);
  if (!folder) notFound();

  const editable = canEditDoc(user, folder);
  const editing = editable && (await searchParams).edit !== undefined;

  const [contents, teams, folderOptions] = await Promise.all([
    listFolderContents(user, folderId),
    editing ? listTeams() : Promise.resolve([]),
    // Never its own subtree: a folder inside its own child has no root.
    editing ? listFolderOptions(user, folderId) : Promise.resolve([]),
  ]);
  const scoped = isSenior(user) ? teams : teams.filter((t) => t.id === user.teamId);
  const placeable = folderOptions.filter((f) => canPlaceDoc(user, f));
  const canAdd = canPlaceDoc(user, folder);

  return (
    <>
      <DocBreadcrumb trail={folder.trail.slice(0, -1)} current={folder.name} />
      <PageHeader
        title={folder.name}
        subtitle={<ScopeBadge scope={folder.visibility} teamName={folder.teamName} />}
        commands={
          editable || canAdd ? (
            <CommandBar>
              {editable ? (
                <Command
                  icon={editing ? X : Pencil}
                  href={editing ? folder.href : `${folder.href}?edit`}
                  active={editing}
                >
                  {editing ? "Done" : "Rename or move"}
                </Command>
              ) : null}
              {canAdd ? (
                <>
                  {editable ? <CommandDivider /> : null}
                  <Command icon={FilePlus} href={`/docs/new?folder=${folder.id}`}>
                    New document here
                  </Command>
                  <Command icon={FolderPlus} href={`/docs/folders/new?parent=${folder.id}`}>
                    New folder here
                  </Command>
                </>
              ) : null}
            </CommandBar>
          ) : null
        }
      />

      {editing ? (
        <div className="mb-6">
          <FolderForm
            action={updateFolder}
            submitLabel="Save changes"
            teams={scoped}
            parents={placeable.map((f) => ({ id: f.id, name: f.name }))}
            canPublishOrgWide={canCreateOrgDocs(user)}
            values={{
              id: folder.id,
              name: folder.name,
              visibility: folder.visibility,
              teamId: folder.teamId ?? "",
              parentId: folder.parentId ?? "",
            }}
          />
        </div>
      ) : null}

      <DocTree
        folders={contents.folders.map(toDocFolderRow)}
        documents={contents.documents.map(toDocNode)}
        empty="This folder is empty."
      />

      {editing ? (
        <form action={deleteFolder} className="mt-6">
          <input type="hidden" name="folderId" value={folder.id} />
          <button
            type="submit"
            className="rounded-md border border-red-400 px-3 py-1.5 text-body-strong text-red-900 transition-colors hover:bg-red-100"
          >
            {contents.folders.length + contents.documents.length > 0
              ? "Delete this folder and everything in it"
              : "Delete folder"}
          </button>
        </form>
      ) : null}
    </>
  );
}
