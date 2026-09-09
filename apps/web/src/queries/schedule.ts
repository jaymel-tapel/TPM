import "server-only";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { taskSchedule, taskTypes, tasks, type Priority } from "@/db/schema";
import type { TaskTypeRef } from "@meridian/ui";
import { TZ } from "./sql";
import { dayRange, fmt, now, type Zone } from "@/lib/date";

export type PlanEntry = {
  taskId: string;
  title: string;
  type: TaskTypeRef;
  priority: Priority;
  done: boolean;
  startsAt: Date;
  minutes: number;
};

/**
 * One person's plan for one day, in the order they mean to work it.
 *
 * The query builder rather than raw SQL, deliberately: drizzle swaps
 * node-postgres' timestamp parsers so it can map them itself, which means a raw
 * `db.execute` hands back the string Postgres printed. That is what crashed the
 * inbox. Here `startsAt` has to be a real Date, so it goes through the mapper.
 */
export async function getDayPlan(
  userId: string,
  reference: Date = now(),
  zone: Zone = TZ,
): Promise<PlanEntry[]> {
  const { start, end } = dayRange(reference, zone);

  const rows = await db
    .select({
      taskId: taskSchedule.taskId,
      title: tasks.title,
      typeSlug: taskTypes.slug,
      typeName: taskTypes.name,
      typeIcon: taskTypes.icon,
      typeTone: taskTypes.tone,
      fallbackType: tasks.type,
      priority: tasks.priority,
      completedAt: tasks.completedAt,
      startsAt: taskSchedule.startsAt,
      minutes: taskSchedule.minutes,
    })
    .from(taskSchedule)
    .innerJoin(tasks, eq(tasks.id, taskSchedule.taskId))
    // Left, because `type_id` is nullable until the enum column goes.
    .leftJoin(taskTypes, eq(taskTypes.id, tasks.typeId))
    .where(
      and(
        eq(taskSchedule.userId, userId),
        gte(taskSchedule.startsAt, start),
        lt(taskSchedule.startsAt, end),
      ),
    )
    .orderBy(asc(taskSchedule.startsAt), asc(taskSchedule.taskId));

  return rows.map((r) => ({
    taskId: r.taskId,
    title: r.title,
    type: {
      slug: r.typeSlug ?? r.fallbackType,
      label: r.typeName ?? r.fallbackType,
      icon: r.typeIcon ?? "clipboard-list",
      tone: r.typeTone ?? "gray",
    },
    priority: r.priority,
    done: r.completedAt !== null,
    startsAt: r.startsAt,
    minutes: r.minutes,
  }));
}

/** Which of these tasks this person has already given a place in today. */
export async function plannedTaskIds(
  userId: string,
  reference: Date = now(),
  zone: Zone = TZ,
): Promise<Set<string>> {
  const { start, end } = dayRange(reference, zone);
  const rows = await db
    .select({ taskId: taskSchedule.taskId })
    .from(taskSchedule)
    .where(
      and(
        eq(taskSchedule.userId, userId),
        gte(taskSchedule.startsAt, start),
        lt(taskSchedule.startsAt, end),
      ),
    );
  return new Set(rows.map((r) => r.taskId));
}

/**
 * How much is already on each of these days, keyed by `yyyy-MM-dd`.
 *
 * What the strip needs to be useful: "is Thursday already full" is the whole
 * question when you are deciding where to put something. One grouped query
 * rather than a `getDayPlan` per chip.
 *
 * Keyed by formatted date rather than by `Date`: a raw `db.execute` hands back
 * whatever Postgres printed, so comparing instants here would mean parsing
 * them first for no gain.
 */
export async function getPlanCounts(
  userId: string,
  days: Date[],
  zone: Zone = TZ,
): Promise<Record<string, number>> {
  if (days.length === 0) return {};

  const first = dayRange(days[0]!, zone).start;
  const last = dayRange(days[days.length - 1]!, zone).end;

  const result = await db.execute(sql`
    select to_char(starts_at at time zone ${zone}, 'YYYY-MM-DD') as day,
           count(*)::int as n
    from task_schedule
    where user_id = ${userId} and starts_at >= ${first} and starts_at < ${last}
    group by 1
  `);

  const counts: Record<string, number> = {};
  for (const day of days) counts[fmt(day, "yyyy-MM-dd", zone)] = 0;
  for (const row of result.rows as unknown as { day: string; n: number }[]) {
    counts[row.day] = row.n;
  }
  return counts;
}
