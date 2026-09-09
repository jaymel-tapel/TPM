import { format } from "date-fns";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { createTask } from "@/actions/tasks";
import { listAllTags } from "@/queries/tasks";
import { listTaskTypes, toTypeRef } from "@/queries/task-types";
import { listBoardOptions } from "@/queries/boards";
import { TaskForm } from "@/components/task-form";
import { now, startOfAppDay } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const { user } = await requireSession();
  const [tags, options, types] = await Promise.all([
    listAllTags(),
    listBoardOptions(user),
    listTaskTypes(),
  ]);
  const firstBoard = options.boards[0];

  // Defaults to 5pm today — the common case is "this needs doing today".
  const defaultDue = new Date(startOfAppDay(now()).getTime() + 17 * 3_600_000);

  return (
    <>
      <PageHeader
        eyebrow="Create"
        title="New Task"
        subtitle="Title, when it's due, and who's on it. Nothing else to configure."
      />
      <TaskForm
        action={createTask}
        submitLabel="Create task"
        peopleByBoard={options.peopleByBoard}
        allTags={tags}
        taskTypes={types.map(toTypeRef)}
        boards={options.boards}
        statusesByBoard={options.statusesByBoard}
        values={{
          title: "",
          description: "",
          type: "client_work",
          // A new task lands on the first board this person can write to, in
          // that board's first column.
          boardId: firstBoard?.id ?? "",
          statusId: firstBoard ? (options.statusesByBoard[firstBoard.id]?.[0]?.id ?? "") : "",
          estimate: "",
          actual: "",
          priority: "normal",
          dueDate: format(defaultDue, "yyyy-MM-dd'T'HH:mm"),
          // The Senior Director sits outside both accounts and so is not an
          // assignable person; they pick who the work is for.
          assignees: user.accountIds.length > 0 ? [user.id] : [],
          tags: [],
        }}
      />
    </>
  );
}
