import { Plus } from "lucide-react";
import {
  Command,
  CommandBar,
  EmptyState,
  PageHeader,
  PRIORITY_LABELS,
  STATUS_KINDS,
  STATUS_KIND_LABELS,
  TASK_TYPE_LABELS,
  TaskList,
  TaskRow,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { listAllTags, listTasks, type TaskFilters } from "@/queries/tasks";
import { userScope } from "@/queries/sql";
import { toTaskRow } from "@/lib/present";
import { toggleTaskDone } from "@/actions/tasks";
import { FilterChips } from "@/components/filter-chips";

export const dynamic = "force-dynamic";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "overdue", label: "Overdue" },
];

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireSession();
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? params[k] : undefined);

  const filters: TaskFilters = {
    status: one("status"),
    type: one("type"),
    priority: one("priority"),
    tag: one("tag"),
    range: one("range") as TaskFilters["range"],
  };

  /*
   * No board view here. My Tasks spans every board a person is on, and a board
   * is now a place rather than a lens — there is no single board to show. The
   * boards themselves are in the rail.
   */
  const [tasks, tags] = await Promise.all([
    listTasks(userScope(user.id), filters),
    listAllTags(),
  ]);

  const open = tasks.filter((t) => t.completedAt === null);
  const done = tasks.filter((t) => t.completedAt !== null);

  return (
    <>
      <PageHeader
        title="My Tasks"
        subtitle={`${open.length} open · ${done.length} completed today`}
        commands={
          <CommandBar>
            <Command icon={Plus} href="/tasks/new" tone="primary">
              New Task
            </Command>
          </CommandBar>
        }
      />

      <div className="mb-6">
        <FilterChips
          groups={[
            { param: "range", label: "Date", options: RANGES },
            {
              param: "status",
              label: "State",
              // Kinds, not columns: this list spans every board a person is on,
              // and two boards can call the same thing different names.
              options: STATUS_KINDS.map((kind) => ({
                value: kind,
                label: STATUS_KIND_LABELS[kind],
              })),
            },
            {
              param: "type",
              label: "Task Type",
              options: Object.entries(TASK_TYPE_LABELS).map(([value, label]) => ({ value, label })),
            },
            {
              param: "priority",
              label: "Priority",
              options: Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
            },
            { param: "tag", label: "Tag", options: tags.map((t) => ({ value: t, label: t })) },
          ]}
        />
      </div>

      <div className="space-y-8">
        {open.length === 0 && done.length === 0 ? (
          <EmptyState>No tasks match those filters.</EmptyState>
        ) : null}

        {open.length > 0 ? (
          <TaskList title="Open">
            {open.map((task) => (
              <TaskRow
                key={task.id}
                task={toTaskRow(task)}
                viewer={user.id}
                onToggle={toggleTaskDone}
              />
            ))}
          </TaskList>
        ) : null}

        {done.length > 0 ? (
          <TaskList title="Completed" tone="quiet">
            {done.map((task) => (
              <TaskRow
                key={task.id}
                task={toTaskRow(task)}
                viewer={user.id}
                onToggle={toggleTaskDone}
                quiet
              />
            ))}
          </TaskList>
        ) : null}
      </div>
    </>
  );
}
