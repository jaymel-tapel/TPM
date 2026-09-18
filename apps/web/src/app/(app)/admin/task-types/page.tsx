import Link from "next/link";
import { Plus } from "lucide-react";
import {
  Command,
  CommandBar,
  PageHeader,
  Panel,
  SectionHeader,
  TypeLabel,
} from "@tpm/ui";
import { requireSession } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";
import { listTaskTypesWithUse, toTypeRef } from "@/queries/task-types";
import { RetireTypeButton } from "@/components/retire-type-button";

export const dynamic = "force-dynamic";

/**
 * The kinds of work this department recognises.
 *
 * Six shipped, because six is what one agency needed. They are rows now, so
 * the next one can say "Pitch" or "Post-production" without a deploy — and the
 * rule that keeps that from becoming a mess is that a kind is a name, a glyph
 * and a tone, and never a field of its own.
 */
export default async function AdminTaskTypesPage() {
  const { user } = await requireSession();
  await assertCanAdminister(user);

  const types = await listTaskTypesWithUse();
  const live = types.filter((t) => t.archivedAt === null);
  const retired = types.filter((t) => t.archivedAt !== null);

  const row = (type: (typeof types)[number]) => (
    <li key={type.id} className="flex items-center gap-4 px-4 py-3">
      <Link
        href={`/admin/task-types/${type.id}`}
        className="min-w-0 flex-1 truncate text-body-strong text-gray-1000 hover:text-blue-800"
      >
        <TypeLabel type={toTypeRef(type)} />
      </Link>
      <span className="tabular w-28 shrink-0 text-right text-caption text-gray-600">
        {type.taskCount} {type.taskCount === 1 ? "task" : "tasks"}
      </span>
      <RetireTypeButton id={type.id} retired={type.archivedAt !== null} />
    </li>
  );

  return (
    <>
      <PageHeader
        title="Task types"
        subtitle="What kind of work a task is. Six to start with; add the ones this department actually does."
        aside={
          <Link href="/admin" className="text-body-strong text-blue-700 hover:text-blue-800">
            ← Back to admin
          </Link>
        }
        commands={
          <CommandBar>
            <Command icon={Plus} href="/admin/task-types/new">
              Add a type
            </Command>
          </CommandBar>
        }
      />

      <SectionHeader aside={`${live.length} ${live.length === 1 ? "type" : "types"}`}>
        In use
      </SectionHeader>
      <Panel className="mb-10">
        <ul className="divide-y divide-gray-300">{live.map(row)}</ul>
      </Panel>

      {retired.length > 0 ? (
        <>
          <SectionHeader aside={`${retired.length}`}>Retired</SectionHeader>
          <Panel className="mb-10">
            <ul className="divide-y divide-gray-300">{retired.map(row)}</ul>
          </Panel>
        </>
      ) : null}

      <p className="max-w-prose text-caption text-gray-600">
        Nothing is deleted here. A task must have a kind, so one that anything
        has ever been filed under cannot be removed — retiring it takes it out
        of the pickers and leaves that work exactly as it was. The last
        remaining type cannot be retired either: a picker with nothing in it is
        a form nobody can submit.
      </p>
    </>
  );
}
