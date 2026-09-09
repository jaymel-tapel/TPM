import { Plus } from "lucide-react";
import {
  Command,
  CommandBar,
  EmptyState,
  PageHeader,
  TASK_TYPE_LABELS,
  TASK_TYPES,
  TaskList,
  TaskRow,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { listTasks } from "@/queries/tasks";
import { listAccountsById } from "@/queries/accounts";
import { userScope } from "@/queries/sql";
import { toTaskRow } from "@/lib/present";
import { toggleTaskDone } from "@/actions/tasks";
import { FilterBar, FilterSelect } from "@/components/filter-bar";
import { now } from "@/lib/date";
import type { TaskType } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Everything I owe, across every client I work on.
 *
 * The screen the multi-account model exists for. Somebody on Volvo and MG
 * should not have to open two accounts to find out what their day is — an
 * account page answers "how is this client", and this one answers "what do I
 * personally need to do", which is a different question with a different
 * shape.
 *
 * Grouped by when, and the account named on each row: the client is context
 * for the work here, not the thing being organised. Inside an account's own
 * Tasks page it is the opposite, and the account name is dropped because the
 * page already said it.
 */
export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, zone } = await requireSession();
  const query = await searchParams;
  const one = (key: string) => {
    const value = query[key];
    return typeof value === "string" ? value : "";
  };
  const accountId = one("account");
  const type = one("type");

  const reference = now(zone);
  const scope = userScope(user.id);
  const filters = {
    account: accountId || undefined,
    type: (TASK_TYPES as readonly string[]).includes(type) ? (type as TaskType) : undefined,
  };

  const [today, upcoming, overdue, completed, accounts] = await Promise.all([
    listTasks(scope, { ...filters, range: "today" }, reference, zone),
    listTasks(scope, { ...filters, range: "upcoming" }, reference, zone),
    listTasks(scope, { ...filters, range: "overdue" }, reference, zone),
    listTasks(scope, { ...filters, range: "completed" }, reference, zone),
    listAccountsById(user.accountIds),
  ]);

  // The client is named on every row: this list spans all of them, and
  // "which one is this for" is the first thing anybody asks of it.
  const row = (task: Parameters<typeof toTaskRow>[0]) => toTaskRow(task, reference, zone, true);
  const nothing = [today, upcoming, overdue, completed].every((list) => list.length === 0);

  const sections = [
    { title: "Overdue", tone: "danger" as const, tasks: overdue, quiet: false },
    { title: "Today", tone: "default" as const, tasks: today, quiet: false },
    { title: "Upcoming", tone: "default" as const, tasks: upcoming, quiet: false },
    { title: "Completed today", tone: "quiet" as const, tasks: completed, quiet: true },
  ];

  return (
    <>
      <PageHeader
        title="My Tasks"
        subtitle="Everything on you, across every client you work on."
        commands={
          <CommandBar>
            <Command icon={Plus} href="/tasks/new" tone="primary">
              New Task
            </Command>
          </CommandBar>
        }
      />

      <FilterBar>
        <FilterSelect
          name="account"
          value={accountId}
          all="All accounts"
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
        />
        <FilterSelect
          name="type"
          value={type}
          all="Any task type"
          options={TASK_TYPES.map((t) => ({ value: t, label: TASK_TYPE_LABELS[t] }))}
        />
      </FilterBar>

      <div className="mt-6 space-y-8">
        {nothing ? <EmptyState>Nothing on you right now.</EmptyState> : null}
        {sections.map((section) =>
          section.tasks.length > 0 ? (
            <TaskList key={section.title} title={section.title} tone={section.tone}>
              {section.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={row(task)}
                  onToggle={toggleTaskDone}
                  quiet={section.quiet}
                />
              ))}
            </TaskList>
          ) : null,
        )}
      </div>
    </>
  );
}
