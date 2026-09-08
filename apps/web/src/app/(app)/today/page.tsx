import { Plus } from "lucide-react";
import {
  Command,
  CommandBar,
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
import { getDayPlan } from "@/queries/schedule";
import { toPlanBlock, toTaskRow } from "@/lib/present";
import { toggleTaskDone } from "@/actions/tasks";
import { planTaskNext } from "@/actions/schedule";
import { dayRange, fmt, fmtLongDate, greeting, now } from "@/lib/date";
import { MINUTES_PER_HOUR, atMinutes, gridRange, minutesFromMidnight } from "@/lib/plan";
import { DayPlanPanel } from "@/components/day-plan-panel";

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

  const plan = (await getDayPlan(user.id, today)).map(toPlanBlock);
  const planned = new Set(plan.map((b) => b.taskId));
  const { startHour, endHour } = gridRange(plan);
  /*
   * The hour labels are formatted here, not in the component: `@meridian/ui`
   * has no clock, and the app reasons in one fixed timezone whatever the
   * viewer's laptop is set to.
   */
  const hourLabels = Object.fromEntries(
    Array.from({ length: endHour - startHour }, (_, i) => {
      const minutes = (startHour + i) * MINUTES_PER_HOUR;
      // "9 AM", not "9:00 AM" — an hour rule has no minutes to report,
      // and the long form wraps in the gutter.
      return [minutes, fmt(atMinutes(today, minutes), "h a")];
    }),
  );

  const plannable = { onPlan: planTaskNext } as const;

  return (
    <div className="space-y-8">
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
              <dl className="flex flex-wrap gap-x-12 gap-y-4 sm:ml-auto">
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

      {/*
        The plan sits beside the lists rather than beside the whole page: the
        summary above counts the day and wants the width, and a task only has
        to travel as far as the next column to be planned.
      */}
      <div className="grid gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-8">
        {day.overdue.length > 0 ? (
          <TaskList title="Overdue" tone="danger">
            {day.overdue.map((task) => (
              <TaskRow
                key={task.id}
                task={row(task)}
                viewer={user.id}
                onToggle={toggleTaskDone}
                planned={planned.has(task.id)}
                {...plannable}
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
                planned={planned.has(task.id)}
                {...plannable}
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

        {/* Sticky, so it stays in view while you work the lists beside it. */}
        <aside className="lg:sticky lg:top-8">
        <DayPlanPanel
          blocks={plan}
          startHour={startHour}
          endHour={endHour}
          nowMinutes={minutesFromMidnight(today)}
          dayStartIso={dayRange(today).start.toISOString()}
          hourLabels={hourLabels}
        />
        </aside>
      </div>
    </div>
  );
}
