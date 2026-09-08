import { ListChecks, Plus } from "lucide-react";
import {
  Command,
  CommandBar,
  CommandDivider,
  EmptyState,
  Panel,
  Percent,
  Stat,
  TaskList,
  TaskRow,
} from "@meridian/ui";
import { Progress } from "@meridian/ui/primitives/progress";
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

  const pending = day.today.length;

  return (
    <div className="space-y-8">
      <div className="min-w-0 space-y-8">
        <header>
          <p className="text-caption-strong uppercase tracking-[0.08em] text-gray-600">
            {fmtLongDate(today)}
          </p>
          <h1 className="mt-3 text-title-1 text-gray-1000">
            {greeting(today)}, {user.name.split(" ")[0]}
          </h1>
          {/* The panel below counts the day; saying it twice in two shapes
              just makes the reader check whether they agree. */}
          {day.due === 0 ? (
            <p className="mt-2 text-body text-gray-700">Nothing scheduled for today.</p>
          ) : null}

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

        {/*
          The same rollup the team screen uses, so a person and their manager
          read one shape of summary rather than two. Overdue, pending and
          completed account for every task the day holds — they add up, which
          a percentage on its own never let you check.

          With nothing due, the percentage is dropped rather than shown as the
          100% that `pct` returns for 0/0. That answer is right for a person
          who has finished, and absurd next to four zeros; overdue work leads
          instead, because that is the only number left that means anything.
        */}
        {day.due > 0 || day.overdue.length > 0 ? (
          <Panel className="p-6">
            <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
              {day.due > 0 ? (
                <Stat
                  value={<Percent value={day.percent} />}
                  label="Completion today"
                  size="xl"
                />
              ) : (
                <Stat
                  value={day.overdue.length}
                  label={day.overdue.length === 1 ? "Overdue task" : "Overdue tasks"}
                  size="xl"
                  tone="danger"
                />
              )}
              <dl className="flex flex-wrap gap-x-12 gap-y-4">
                {day.due > 0 ? (
                  <Stat
                    value={day.overdue.length}
                    label="Overdue"
                    size="sm"
                    tone={day.overdue.length > 0 ? "danger" : "default"}
                  />
                ) : null}
                <Stat value={pending} label="Pending" size="sm" />
                <Stat value={day.done} label="Completed" size="sm" />
                <Stat value={day.due} label="Due today" size="sm" />
              </dl>
            </div>
            {day.due > 0 ? <Progress value={day.percent} className="mt-8 h-1.5" /> : null}
          </Panel>
        ) : null}

        {day.overdue.length > 0 ? (
          <TaskList title="Overdue" tone="danger">
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
    </div>
  );
}
