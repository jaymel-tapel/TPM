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
  listDocChildren,
  listDocParentOptions,
} from "@/queries/docs";
import { toDocBacklink, toDocSummaryNode } from "@/lib/present";
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

  const [children, backlinks, teams, parents] = await Promise.all([
    listDocChildren(user, id),
    getDocBacklinks(user, id),
    editing ? listTeams() : Promise.resolve([]),
    // Never its own subtree: a document filed under its own child has no root.
    editing ? listDocParentOptions(user, id) : Promise.resolve([]),
  ]);
  const scoped = isSenior(user) ? teams : teams.filter((t) => t.id === user.teamId);
  // Filing under a document adopts its scope, so only offer parents whose
  // scope this person is allowed to write in — otherwise the form offers a
  // choice the save would refuse.
  const placeable = parents.filter((p) => canPlaceDoc(user, p));
  // A reader with no verbs gets no strip: an empty command bar is a rule under
  // the title with nothing above it.
  const canAddChild = canPlaceDoc(user, doc);
  const hasCommands = editable || canAddChild;

  return (
    <>
      <DocBreadcrumb trail={doc.trail} />
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
            {canAddChild ? (
              <>
                {editable ? <CommandDivider /> : null}
                <Command icon={Plus} href={`/docs/new?parent=${doc.id}`}>
                  Add a child
                </Command>
              </>
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
          parents={placeable.map((p) => ({ id: p.id, title: p.title }))}
          canPublishOrgWide={canCreateOrgDocs(user)}
          values={{
            id: doc.id,
            title: doc.title,
            body: doc.body ?? "",
            visibility: doc.visibility,
            teamId: doc.teamId ?? "",
            parentId: doc.parentId ?? "",
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

      {children.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-2 text-caption-strong uppercase tracking-[0.08em] text-gray-600">
            Filed under this
          </h2>
          <DocTree nodes={children.map(toDocSummaryNode)} />
        </div>
      ) : null}

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
            {children.length > 0
              ? `Delete this and the ${children.length} document${children.length === 1 ? "" : "s"} under it`
              : "Delete document"}
          </button>
        </form>
      ) : null}
    </>
  );
}
