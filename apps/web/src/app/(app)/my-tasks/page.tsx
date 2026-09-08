import {
  ButtonLink,
  EmptyState,
  TaskBoard,
  ViewToggle,
  PageHeader,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_TYPE_LABELS,
  TaskList,
  TaskRow,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { getBoardView, listAllTags, listTasks, type TaskFilters } from "@/queries/tasks";
import { userScope } from "@/queries/sql";
import { toBoard, toTaskRow } from "@/lib/present";
import { setTaskStatus, toggleTaskDone } from "@/actions/tasks";
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

  const view = one("view") === "board" ? "board" : "list";

  const [tasks, tags, board] = await Promise.all([
    listTasks(userScope(user.id), filters),
    listAllTags(),
    view === "board" ? getBoardView(userScope(user.id)) : Promise.resolve(null),
  ]);

  const open = tasks.filter((t) => t.completedAt === null);
  const done = tasks.filter((t) => t.completedAt !== null);

  return (
    <>
      <PageHeader
        title="My Tasks"
        subtitle={`${open.length} open · ${done.length} completed today`}
        aside={
          <div className="flex items-center gap-3">
            <ViewToggle listHref="/my-tasks" boardHref="/my-tasks?view=board" active={view} />
            <ButtonLink href="/tasks/new">New Task</ButtonLink>
          </div>
        }
      />

      {board ? null : (
      <div className="mb-6">
        <FilterChips
          groups={[
            { param: "range", label: "Date", options: RANGES },
            {
              param: "status",
              label: "Status",
              options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
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
      )}

      {board ? (
        <TaskBoard
          board={toBoard(board)}
          viewer={user.id}
          onMove={setTaskStatus}
          moreHref="/my-tasks"
        />
      ) : (
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
      )}
    </>
  );
}
