import Link from "next/link";
import { Progress } from "@meridian/ui/primitives/progress";
import {
  EmptyState,
  Panel,
  Percent,
  ROLE_LABELS,
  Stat,
  TaskList,
  TaskRow,
  UserAvatar,
} from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { assertCanViewUser } from "@/lib/permissions";
import { getDayView, listTasks } from "@/queries/tasks";
import { userScope } from "@/queries/sql";
import { getReportMetrics } from "@/queries/reports";
import { toTaskRow } from "@/lib/present";
import { toggleTaskDone } from "@/actions/tasks";
import { fmtLongDate, now } from "@/lib/date";

export const dynamic = "force-dynamic";

/** Clicking a person opens their day — the same view they see themselves. */
export default async function PersonPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const { user: viewer } = await requireSession();
  const person = await assertCanViewUser(viewer, userId);

  const [day, metrics, overdue] = await Promise.all([
    getDayView(person.id),
    getReportMetrics(userScope(person.id), 7),
    listTasks(userScope(person.id), { range: "overdue" }),
  ]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <UserAvatar name={person.name} size="xl" />
          <div>
            <p className="text-label-12 uppercase tracking-[0.08em] text-gray-600">
              {ROLE_LABELS[person.role]}
            </p>
            <h1 className="mt-2 text-heading-32 text-gray-1000">{person.name}</h1>
            <p className="mt-1 text-copy-14 text-gray-700">{fmtLongDate(now())}</p>
          </div>
        </div>
        <Link
          href={viewer.role === "senior_director" ? "/teams" : "/team"}
          className="text-label-14 text-blue-700 hover:text-blue-800"
        >
          ← Back to team
        </Link>
      </div>

      <Panel className="p-8">
        <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
          <Stat
            value={<Percent value={day.percent} />}
            label="Completion today"
            size="xl"
          />
          <dl className="flex flex-wrap gap-x-12 gap-y-4">
            <Stat value={day.due} label="Due today" size="sm" />
            <Stat value={day.done} label="Completed" size="sm" />
            <Stat
              value={overdue.length}
              label="Overdue"
              size="sm"
              tone={overdue.length > 0 ? "danger" : "default"}
            />
            <Stat value={`${metrics.completionRate}%`} label="7-day rate" size="sm" />
          </dl>
        </div>
        <Progress value={day.percent} className="mt-8 h-1.5" />
      </Panel>

      {overdue.length > 0 ? (
        <TaskList title="Overdue" tone="danger">
          {overdue.map((task) => (
            <TaskRow
              key={task.id}
              task={toTaskRow(task)}
              viewer={person.id}
              onToggle={toggleTaskDone}
            />
          ))}
        </TaskList>
      ) : null}

      {day.today.length === 0 ? (
        <section>
          <p className="mb-3 text-label-12 uppercase tracking-[0.08em] text-gray-600">Today</p>
          <EmptyState>Nothing left for today.</EmptyState>
        </section>
      ) : (
        <TaskList title="Today">
          {day.today.map((task) => (
            <TaskRow
              key={task.id}
              task={toTaskRow(task)}
              viewer={person.id}
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
              task={toTaskRow(task)}
              viewer={person.id}
              onToggle={toggleTaskDone}
              quiet
            />
          ))}
        </TaskList>
      ) : null}
    </div>
  );
}
