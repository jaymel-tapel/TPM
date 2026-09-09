import Link from "next/link";
import { Plus } from "lucide-react";
import {
  Command,
  CommandBar,
  EmptyState,
  Panel,
  Percent,
  Stat,
  DayStrip,
  TaskList,
  TaskRow,
} from "@meridian/ui";
import { Progress } from "@meridian/ui/primitives/progress";
import { requireSession } from "@/lib/auth";
import { getDayView } from "@/queries/tasks";
import { getDayPlan, getPlanCounts, plannedTaskIds } from "@/queries/schedule";
import { toPlanBlock, toTaskRow } from "@/lib/present";
import { toggleTaskDone } from "@/actions/tasks";
import { planTaskNext } from "@/actions/schedule";
import {
  dayRange,
  fmt,
  fmtLongDate,
  greeting,
  isSameAppDay,
  now,
} from "@/lib/date";
import {
  MINUTES_PER_HOUR,
  atMinutes,
  gridRange,
  minutesFromMidnight,
  planDays,
} from "@/lib/plan";
import { DayPlanPanel } from "@/components/day-plan-panel";

export const dynamic = "force-dynamic";

/** "9 AM" / "12 PM" — the same shape the grid's gutter uses. */
function hourLabelFor(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/**
 * Screen 1. The day opens as a work sheet, not a board: what's left, what's
 * done, and one honest percentage.
 */
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  /* Everything on this screen is reckoned in the reader's own timezone: which
     tasks are due today, what counts as overdue, where the grid's hours fall.
     Both come off the session, so no page can forget to ask. */
  const { user, zone, hours } = await requireSession();
  const today = now(zone);
  const dayView = getDayView(user.id, today, zone);
  // Today spans every client too, so each row says which.
  const row = (t: Parameters<typeof toTaskRow>[0]) => toTaskRow(t, today, zone, true);

  /*
   * The lists always show today — that is what this screen is. Only the plan
   * moves, so you can block out Thursday without losing sight of what is due
   * now. The day lives in the URL, so it survives a reload.
   */
  const days = planDays(today, zone);
  const asked = (await searchParams).plan;
  const on = days.find((d) => fmt(d, "yyyy-MM-dd", zone) === asked) ?? days[0]!;
  const showingToday = isSameAppDay(on, today, zone);

  /*
   * The day and the three plan reads at once. `getDayView` was started above,
   * before the day being planned was known, because it never depended on it —
   * awaiting it there made three independent queries wait for a fourth.
   */
  const [day, planEntries, planned, counts] = await Promise.all([
    dayView,
    getDayPlan(user.id, on, zone),
    plannedTaskIds(user.id, on, zone),
    getPlanCounts(user.id, days, zone),
  ]);
  const plan = planEntries.map((e) => toPlanBlock(e, zone));
  const pending = day.today.length;
  const { startHour, endHour } = gridRange(plan, hours);
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
      return [minutes, fmt(atMinutes(on, minutes, zone), "h a", zone)];
    }),
  );

  const dayChips = days.map((d) => {
    const key = fmt(d, "yyyy-MM-dd", zone);
    return {
      href: isSameAppDay(d, today, zone) ? "/today" : `/today?plan=${key}`,
      weekday: fmt(d, "EEE", zone),
      day: fmt(d, "d", zone),
      count: counts[key] ?? 0,
      active: isSameAppDay(d, on, zone),
      today: isSameAppDay(d, today, zone),
    };
  });

  /* Rows carry the day the plan is showing, so Plan puts work where you are
     looking rather than always into today. */
  const plannable = { onPlan: planTaskNext, planDay: fmt(on, "yyyy-MM-dd", zone) } as const;

  return (
    <div className="space-y-8">
        <header>
          <p className="text-caption-strong uppercase tracking-[0.08em] text-gray-600">
            {fmtLongDate(today, zone)}
          </p>
          <h1 className="mt-3 text-title-1 text-gray-1000">
            {greeting(today, zone)}, {user.name.split(" ")[0]}
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
          The same rollup the account screen uses, so a person and their manager
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
              {day.due === 0
                ? day.upcoming.length > 0
                  ? "Nothing is due today. What is coming is below."
                  : "Nothing is due today."
                : "Everything due today is done."}
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

        {day.upcoming.length > 0 ? (
          <TaskList title="Upcoming">
            {day.upcoming.map((task) => (
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
          <DayStrip days={dayChips} />
          <DayPlanPanel
            blocks={plan}
            startHour={startHour}
            endHour={endHour}
            /* The now line belongs to today and to no other day. */
            nowMinutes={showingToday ? minutesFromMidnight(today, zone) : null}
            day={fmt(on, "yyyy-MM-dd", zone)}
            hourLabels={hourLabels}
          />
          {/* Small, quiet, and under the thing it explains: the grid's hours
              are a preference, and the only place anyone wonders about them is
              while looking at the grid. */}
          <p className="mt-2 text-caption text-gray-600">
            <Link
              href="/settings"
              className="text-blue-700 underline-offset-2 hover:underline"
            >
              {hourLabelFor(hours.startHour)}–{hourLabelFor(hours.endHour)} · {zone}
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
