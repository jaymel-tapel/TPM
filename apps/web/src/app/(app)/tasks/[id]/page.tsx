import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { Button } from "@meridian/ui/primitives/button";
import {
  AvatarStack,
  PageHeader,
  Panel,
  StatusBadge,
  TASK_STATUSES,
  cn,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { canEditTask, canViewTask } from "@/lib/permissions";
import { db } from "@/db";
import { tasks as tasksTable } from "@/db/schema";
import { getTaskCard, listAllTags } from "@/queries/tasks";
import { getAttachments } from "@/queries/attachments";
import { listAssignableUsers } from "@/queries/team";
import { setTaskStatus, updateTask } from "@/actions/tasks";
import { DeleteTaskButton } from "@/components/delete-task-button";
import { TaskForm } from "@/components/task-form";
import { TaskAttachments } from "@/components/task-attachments";
import { RichTextView } from "@meridian/ui/editor";
import { dueLabel } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireSession();

  const record = await db.query.tasks.findFirst({ where: eq(tasksTable.id, id) });
  if (!record || !(await canViewTask(user, record))) notFound();
  const editable = await canEditTask(user, record);

  const [task, people, tags, attachments] = await Promise.all([
    getTaskCard(id),
    listAssignableUsers(),
    listAllTags(),
    getAttachments(id),
  ]);
  if (!task) notFound();

  return (
    <>
      <PageHeader
        eyebrow={dueLabel(task.dueDate)}
        title={task.title}
        subtitle={
          task.assignees.length > 1 ? (
            <span className="inline-flex items-center gap-2">
              <AvatarStack names={task.assignees.map((a) => a.name)} />
              {`Collaborative · ${task.assignees.length} people`}
            </span>
          ) : (
            task.assignees[0]?.name
          )
        }
        aside={
          <Link href="/today" className="text-body-strong text-blue-700 hover:text-blue-800">
            ← Back to today
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {TASK_STATUSES.map((status) => (
          <form key={status} action={setTaskStatus}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="status" value={status} />
            <button
              type="submit"
              disabled={!editable}
              className={cn(
                "flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-body-strong transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                task.status === status
                  ? "border-blue-700 bg-blue-100 text-blue-900"
                  : "border-gray-400 bg-background-100 text-gray-700 hover:border-gray-500 hover:text-gray-1000",
              )}
            >
              <StatusBadge status={status} />
            </button>
          </form>
        ))}
      </div>

      {editable ? (
        <TaskForm
          action={updateTask}
          submitLabel="Save changes"
          people={people}
          allTags={tags}
          values={{
            id: task.id,
            title: task.title,
            description: task.description ?? "",
            type: task.type,
            status: task.status,
            priority: task.priority,
            dueDate: format(task.dueDate, "yyyy-MM-dd'T'HH:mm"),
            assignees: task.assignees.map((a) => a.id),
            tags: task.tags,
          }}
        />
      ) : (
        <Panel className="p-6">
          {task.description ? (
            <RichTextView value={task.description} />
          ) : (
            <p className="text-body text-gray-600">No description.</p>
          )}
          <p className="mt-4 text-caption text-gray-600">
            Assigned to {task.assignees.map((a) => a.name).join(", ")}. You have read-only access
            to this task.
          </p>
        </Panel>
      )}

      <div className="mt-6">
        <TaskAttachments taskId={task.id} attachments={attachments} editable={editable} />
      </div>

      {editable ? (
        <div className="mt-6">
          <DeleteTaskButton
            taskId={task.id}
            title={task.title}
            otherAssignees={task.assignees
              .filter((a) => a.id !== user.id)
              .map((a) => a.name)}
          />
        </div>
      ) : null}
    </>
  );
}
