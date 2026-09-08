import { ListChecks, Plus } from "lucide-react";
import {
  Command,
  CommandBar,
  CommandDivider,
  CompletionMeter,
  EmptyState,
  TaskList,
  TaskRow,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { getDayView } from "@/queries/tasks";
import { toTaskRow } from "@/lib/present";
import { toggleTaskDone } from "@/actions/tasks";
import { fmtLongDate, greeting, now } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * Screen 1. The day opens as a work sheet, not a board: what's left, what's
 * done, and one honest percentage.
 */
export default async function TodayPage() {
  const { user } = await requireSession();
  const today = now();
  const day = await getDayView(user.id, today);
  const row = (t: Parameters<typeof toTaskRow>[0]) => toTaskRow(t, today);

  return (
    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
      <div className="min-w-0 space-y-8">
        <header>
          <p className="text-caption-strong uppercase tracking-[0.08em] text-gray-600">
            {fmtLongDate(today)}
          </p>
          <h1 className="mt-3 text-title-1 text-gray-1000">
            {greeting(today)}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-2 text-body text-gray-700">
            {day.due === 0 ? (
              "Nothing scheduled for today."
            ) : (
              <>
                <span className="text-gray-1000">
                  {day.done} of {day.due}
                </span>{" "}
                tasks completed today
              </>
            )}
          </p>

          <CommandBar className="mt-4">
            <Command icon={Plus} href="/tasks/new" tone="primary">
              New Task
            </Command>
            <CommandDivider />
            <Command icon={ListChecks} href="/my-tasks">
              All my tasks
            </Command>
          </CommandBar>
        </header>

        {day.overdue.length > 0 ? (
          <TaskList title="Carried over" tone="danger">
            {day.overdue.map((task) => (
              <TaskRow
                key={task.id}
                task={row(task)}
                viewer={user.id}
                onToggle={toggleTaskDone}
              />
            ))}
          </TaskList>
        ) : null}

        {day.today.length === 0 ? (
          <section>
            <p className="mb-3 text-caption-strong uppercase tracking-[0.08em] text-gray-600">Today</p>
            <EmptyState>
              {day.due === 0 ? "Nothing is due today." : "Everything due today is done."}
            </EmptyState>
          </section>
        ) : (
          <TaskList title="Today">
            {day.today.map((task) => (
              <TaskRow
                key={task.id}
                task={row(task)}
                viewer={user.id}
                onToggle={toggleTaskDone}
              />
            ))}
          </TaskList>
        )}

        {day.completed.length > 0 ? (
          <TaskList title="Completed" tone="quiet">
            {day.completed.map((task) => (
              <TaskRow
                key={task.id}
                task={row(task)}
                viewer={user.id}
                onToggle={toggleTaskDone}
                quiet
              />
            ))}
          </TaskList>
        ) : null}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <div className="rounded-xl border border-gray-400 bg-background-100 p-6">
          <CompletionMeter done={day.done} due={day.due} percent={day.percent} />
        </div>

        {day.overdue.length > 0 ? (
          <div className="rounded-xl border border-red-300 bg-red-100 p-6">
            <p className="text-caption-strong uppercase tracking-[0.08em] text-red-700">Carried over</p>
            <p className="tabular mt-3 text-title-1 text-red-700">{day.overdue.length}</p>
            <p className="mt-1 text-caption text-red-900">
              {day.overdue.length === 1 ? "task from" : "tasks from"} earlier days
            </p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
