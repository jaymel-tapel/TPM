import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { BookOpen, Pencil, Plus } from "lucide-react";
import {
  Command,
  CommandBar,
  CommandDivider,
  DocBacklinkList,
  DocBreadcrumb,
  DocTree,
  PageHeader,
  Panel,
  ScopeBadge,
} from "@meridian/ui";
import { RichTextView } from "@meridian/ui/editor";
import { requireSession } from "@/lib/auth";
import { canCreateOrgDocs, canEditDoc, canPlaceDoc, isSenior } from "@/lib/permissions";
import { listTeams } from "@/queries/team";
import {
  getDoc,
  getDocBacklinks,
  listFolderOptions,
} from "@/queries/docs";
import { toDocBacklink } from "@/lib/present";
import { updateDoc, deleteDoc } from "@/actions/docs";
import { DocForm } from "@/components/doc-form";

export const dynamic = "force-dynamic";

export default async function DocPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { user } = await requireSession();

  const doc = await getDoc(user, id);
  if (!doc) notFound();

  const editable = canEditDoc(user, doc);
  /*
   * A document opens as something to read. Editing is a verb you reach for,
   * not the state you land in — a task detail page is where you go to act on
   * something, but a document is read far more often than it is rewritten, and
   * landing in a form makes the reading feel like an interruption.
   */
  const editing = editable && (await searchParams).edit !== undefined;

  const [backlinks, teams, folderOptions] = await Promise.all([
    getDocBacklinks(user, id),
    editing ? listTeams() : Promise.resolve([]),
    editing ? listFolderOptions(user) : Promise.resolve([]),
  ]);
  const scoped = isSenior(user) ? teams : teams.filter((t: { id: string }) => t.id === user.teamId);
  // A document takes its folder's scope, so only offer folders this person is
  // allowed to write in — otherwise the form offers a choice the save refuses.
  const placeable = folderOptions.filter((f) => canPlaceDoc(user, f));
  // A reader with no verbs gets no strip: an empty command bar is a rule under
  // the title with nothing above it.
  const hasCommands = editable;

  return (
    <>
      <DocBreadcrumb trail={doc.trail} current={doc.title} />
      <PageHeader
        title={doc.title}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <ScopeBadge scope={doc.visibility} teamName={doc.teamName} />
            {`${doc.authorName} · updated ${format(doc.updatedAt, "d MMM yyyy")}`}
          </span>
        }
        aside={
          <Link href="/docs" className="text-body-strong text-blue-700 hover:text-blue-800">
            ← All docs
          </Link>
        }
        commands={
          hasCommands ? (
          <CommandBar>
            {editable ? (
              <Command
                icon={editing ? BookOpen : Pencil}
                href={editing ? `/docs/${doc.id}` : `/docs/${doc.id}?edit`}
                active={editing}
              >
                {editing ? "Done editing" : "Edit"}
              </Command>
            ) : null}
                      </CommandBar>
          ) : null
        }
      />

      {editing ? (
        <DocForm
          action={updateDoc}
          submitLabel="Save changes"
          teams={scoped}
          folders={placeable.map((f) => ({ id: f.id, name: f.name }))}
          canPublishOrgWide={canCreateOrgDocs(user)}
          values={{
            id: doc.id,
            title: doc.title,
            body: doc.body ?? "",
            visibility: doc.visibility,
            teamId: doc.teamId ?? "",
            folderId: doc.folderId ?? "",
          }}
        />
      ) : (
        <Panel className="p-6">
          {doc.body ? (
            <RichTextView value={doc.body} />
          ) : (
            <p className="text-body text-gray-600">
              {editable
                ? "Nothing written here yet. Choose Edit to start it."
                : "Nothing written here yet."}
            </p>
          )}
        </Panel>
      )}

      <div className="mt-6">
        <DocBacklinkList tasks={backlinks.map(toDocBacklink)} />
      </div>

      {editing ? (
        <form action={deleteDoc} className="mt-6">
          <input type="hidden" name="docId" value={doc.id} />
          <button
            type="submit"
            className="rounded-md border border-red-400 px-3 py-1.5 text-body-strong text-red-900 transition-colors hover:bg-red-100"
          >
            Delete document
          </button>
        </form>
      ) : null}
    </>
  );
}
