import Link from "next/link";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";
import { createTaskType } from "@/actions/vocabulary";
import { TaskTypeForm } from "@/components/task-type-form";

export const dynamic = "force-dynamic";

export default async function NewTaskTypePage() {
  const { user } = await requireSession();
  await assertCanAdminister(user);

  return (
    <>
      <PageHeader
        title="Add a task type"
        subtitle="It appears in every task form and every board filter as soon as it is saved."
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
        action={createTaskType}
        submitLabel="Add type"
        values={{ name: "", icon: "clipboard-list", tone: "gray", position: 0 }}
      />
    </>
  );
}
