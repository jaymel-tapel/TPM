import { format } from "date-fns";
import { PageHeader } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { createTask } from "@/actions/tasks";
import { listAssignableUsers } from "@/queries/team";
import { listAllTags } from "@/queries/tasks";
import { TaskForm } from "@/components/task-form";
import { now, startOfAppDay } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const { user } = await requireSession();
  const [people, tags] = await Promise.all([listAssignableUsers(), listAllTags()]);

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
        people={people}
        allTags={tags}
        values={{
          title: "",
          description: "",
          type: "client_work",
          status: "todo",
          priority: "normal",
          dueDate: format(defaultDue, "yyyy-MM-dd'T'HH:mm"),
          // The Senior Director sits outside both teams and so is not an
          // assignable person; they pick who the work is for.
          assignees: user.teamId ? [user.id] : [],
          tags: [],
        }}
      />
    </>
  );
}
