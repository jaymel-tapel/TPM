import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";
import { updateTaskType } from "@/actions/vocabulary";
import { getTaskType } from "@/queries/task-types";
import { TaskTypeForm } from "@/components/task-type-form";

export const dynamic = "force-dynamic";

export default async function EditTaskTypePage({
  params,
}: {
  params: Promise<{ typeId: string }>;
}) {
  const { typeId } = await params;
  const { user } = await requireSession();
  await assertCanAdminister(user);

  const type = await getTaskType(typeId);
  if (!type) notFound();

  return (
    <>
      <PageHeader
        title={type.name}
        subtitle={
          type.archivedAt
            ? "Retired. Still on the work that carries it, offered to nothing new."
            : "Every task already filed under this changes with it."
        }
        aside={
          <Link
            href="/admin/task-types"
            className="text-body-strong text-blue-700 hover:text-blue-800"
          >
            ← Back to task types
          </Link>
        }
      />
      <TaskTypeForm
        action={updateTaskType}
        submitLabel="Save changes"
        values={{
          id: type.id,
          name: type.name,
          icon: type.icon,
          tone: type.tone,
          position: type.position,
        }}
      />
    </>
  );
}
