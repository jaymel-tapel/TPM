import "server-only";
import { asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { taskTypes } from "@/db/schema";
import type { TaskTypeRef } from "@tpm/ui";

export type TaskTypeRow = typeof taskTypes.$inferSelect;

/** The shape every screen renders a kind from. */
export const toTypeRef = (row: {
  slug: string;
  name: string;
  icon: string;
  tone: string;
}): TaskTypeRef => ({ slug: row.slug, label: row.name, icon: row.icon, tone: row.tone });

/**
 * The kinds of work this department recognises, in the order it arranged them.
 *
 * Archived ones are left out by default: retiring a kind means nothing new
 * takes it, not that the work which already has it changes. Every screen that
 * *offers* a choice wants the short list; the admin screen wants all of them.
 */
export async function listTaskTypes({ includeArchived = false } = {}): Promise<TaskTypeRow[]> {
  const rows = db.select().from(taskTypes);
  return (includeArchived ? rows : rows.where(isNull(taskTypes.archivedAt))).orderBy(
    asc(taskTypes.position),
    asc(taskTypes.name),
  );
}

export async function getTaskType(id: string): Promise<TaskTypeRow | null> {
  const [row] = await db.select().from(taskTypes).where(eq(taskTypes.id, id));
  return row ?? null;
}

export async function getTaskTypeBySlug(slug: string): Promise<TaskTypeRow | null> {
  const [row] = await db.select().from(taskTypes).where(eq(taskTypes.slug, slug));
  return row ?? null;
}

/**
 * How much work wears each kind. What makes retiring one a decision rather
 * than a guess, the way a person's task count does on the admin people list.
 */
export async function listTaskTypesWithUse(): Promise<(TaskTypeRow & { taskCount: number })[]> {
  const result = await db.execute(sql`
    select ty.id, ty.slug, ty.name, ty.icon, ty.tone, ty.position,
           ty.archived_at as "archivedAt",
           (select count(*) from tasks k where k.type_id = ty.id)::int as "taskCount"
    from task_types ty
    order by ty.position asc, ty.name asc
  `);
  return result.rows as unknown as (TaskTypeRow & { taskCount: number })[];
}
