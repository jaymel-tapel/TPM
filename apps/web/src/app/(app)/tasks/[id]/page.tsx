import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { Button } from "@meridian/ui/primitives/button";
import {
  AvatarStack,
  PageHeader,
  StatusBadge,
  cn,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { canViewTask } from "@/lib/permissions";
import { db } from "@/db";
import { tasks as tasksTable } from "@/db/schema";
import { getTaskCard, listAllTags } from "@/queries/tasks";
import { getAttachments } from "@/queries/attachments";
import { getActivity } from "@/queries/activity";
import { getLinkedDocs } from "@/queries/docs";
import { listBoardOptions, listBoardStatuses } from "@/queries/boards";
import { setTaskStatus, updateTask } from "@/actions/tasks";
import { DeleteTaskButton } from "@/components/delete-task-button";
import { TaskForm } from "@/components/task-form";
import { TaskAttachments } from "@/components/task-attachments";
import { TaskDocs } from "@/components/task-docs";
import { TaskActivity } from "@/components/task-activity";
import { toActivityItem, toDocRef } from "@/lib/present";
import { dueLabel } from "@/lib/date";
import { formatDuration } from "@/lib/duration";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  // The feed is capped by default; `?activity=all` lifts it. The page is
  // already force-dynamic, so a search param costs nothing and needs no
  // client state or cursor bookkeeping.
  const showAll = (await searchParams).activity === "all";
  const { user } = await requireSession();

  const record = await db.query.tasks.findFirst({ where: eq(tasksTable.id, id) });
  if (!record || !(await canViewTask(user, record))) notFound();

  const [task, tags, attachments, docs, columns, options, activity] = await Promise.all([
    getTaskCard(id),
    listAllTags(),
    getAttachments(id),
    getLinkedDocs(user, id),
    listBoardStatuses(record.boardId),
    listBoardOptions(user),
    getActivity(id, showAll ? null : undefined),
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

      {/* The columns of this task's own board, in the board's order. */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {columns.map((status) => (
          <form key={status.id} action={setTaskStatus}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="statusId" value={status.id} />
            <button
              type="submit"
              className={cn(
                "flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-body-strong transition-colors",
                task.statusId === status.id
                  ? "border-blue-700 bg-blue-100 text-blue-900"
                  : "border-gray-400 bg-background-100 text-gray-700 hover:border-gray-500 hover:text-gray-1000",
              )}
            >
              <StatusBadge status={status} />
            </button>
          </form>
        ))}
      </div>

      <TaskForm
        action={updateTask}
        submitLabel="Save changes"
        peopleByBoard={options.peopleByBoard}
        allTags={tags}
        boards={options.boards}
        statusesByBoard={options.statusesByBoard}
        values={{
          id: task.id,
          title: task.title,
          description: task.description ?? "",
          boardId: task.boardId,
          statusId: task.statusId,
          estimate: formatDuration(task.estimateMinutes),
          actual: formatDuration(task.actualMinutes),
          type: task.type,
          priority: task.priority,
          dueDate: format(task.dueDate, "yyyy-MM-dd'T'HH:mm"),
          assignees: task.assignees.map((a) => a.id),
          tags: task.tags,
        }}
      />

      <div className="mt-6">
        <TaskAttachments taskId={task.id} attachments={attachments} editable />
      </div>

      <div className="mt-6">
        <TaskDocs taskId={task.id} docs={docs.map(toDocRef)} editable />
      </div>

      <div className="mt-6">
        <TaskActivity
          teamId={task.teamId}
          taskId={task.id}
          items={activity.entries.map((entry) => toActivityItem(entry, user))}
          total={activity.total}
          moreHref={`/tasks/${task.id}?activity=all`}
        />
      </div>

      <div className="mt-6">
        <DeleteTaskButton
          taskId={task.id}
          title={task.title}
          otherAssignees={task.assignees.filter((a) => a.id !== user.id).map((a) => a.name)}
        />
      </div>
    </>
  );
}
