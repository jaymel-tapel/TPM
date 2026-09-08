import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { taskSchedule, tasks, type Priority, type TaskType } from "@/db/schema";
import { dayRange, now } from "@/lib/date";

export type PlanEntry = {
  taskId: string;
  title: string;
  type: TaskType;
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
): Promise<PlanEntry[]> {
  const { start, end } = dayRange(reference);

  const rows = await db
    .select({
      taskId: taskSchedule.taskId,
      title: tasks.title,
      type: tasks.type,
      priority: tasks.priority,
      completedAt: tasks.completedAt,
      startsAt: taskSchedule.startsAt,
      minutes: taskSchedule.minutes,
    })
    .from(taskSchedule)
    .innerJoin(tasks, eq(tasks.id, taskSchedule.taskId))
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
    type: r.type,
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
): Promise<Set<string>> {
  const { start, end } = dayRange(reference);
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
