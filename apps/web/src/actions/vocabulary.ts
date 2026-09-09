"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { tags, taskTags, taskTypes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { assertCanAdminister } from "@/lib/permissions";

/**
 * The two vocabularies work is filed under: the kinds of task, and the tags.
 *
 * Both follow the rule the rest of Admin follows — nothing is deleted here.
 * Retiring takes a word out of circulation without taking it off the work that
 * already carries it, because the record of what was done last quarter should
 * not change because somebody tidied a dropdown this morning.
 */
export type FormState = { error?: string } | null;

function refresh() {
  revalidatePath("/", "layout");
}

/* ── Tags ──────────────────────────────────────────────────────────────── */

const tagInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Give the tag a name").max(40),
});

/**
 * Rename, and merge if the new name is taken.
 *
 * `tags.name` is unique, so renaming `nike` to a `Nike` that already exists
 * would otherwise be a constraint violation shown as a form error — when what
 * the person plainly meant was "these are the same tag". So the links move and
 * the loser goes. The composite primary key on `task_tags` means a task
 * carrying both would collide on the way, so those links go first.
 */
export async function renameTag(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  await assertCanAdminister(viewer);

  const parsed = tagInput.safeParse({
    id: formData.get("tagId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { id, name } = parsed.data;

  const [existing] = await db.select().from(tags).where(eq(tags.id, id));
  if (!existing) return { error: "That tag no longer exists." };

  const [clash] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(sql`lower(${tags.name}) = ${name.toLowerCase()}`, ne(tags.id, id)));

  if (clash) {
    await db.transaction(async (tx) => {
      /*
       * Drop the links that would collide before moving the rest. `task_tags`
       * is keyed on both columns, so a task already carrying the survivor
       * cannot also be given it — and an update has no conflict clause to hide
       * behind the way an insert does.
       */
      await tx.execute(sql`
        delete from task_tags a
        where a.tag_id = ${id}::uuid
          and exists (
            select 1 from task_tags b
            where b.task_id = a.task_id and b.tag_id = ${clash.id}::uuid
          )
      `);
      await tx.update(taskTags).set({ tagId: clash.id }).where(eq(taskTags.tagId, id));
      await tx.delete(tags).where(eq(tags.id, id));
    });
  } else {
    await db.update(tags).set({ name }).where(eq(tags.id, id));
  }

  refresh();
  redirect("/admin/tags");
}

const retireInput = z.object({ id: z.string().uuid() });

export async function setTagRetired(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  await assertCanAdminister(viewer);

  const parsed = retireInput.safeParse({ id: formData.get("tagId") });
  if (!parsed.success) return { error: "That tag no longer exists." };

  const retire = formData.get("retire") === "1";
  await db
    .update(tags)
    .set({ archivedAt: retire ? new Date() : null })
    .where(eq(tags.id, parsed.data.id));

  refresh();
  redirect("/admin/tags");
}

/* ── Task types ────────────────────────────────────────────────────────── */

/**
 * A slug is derived once, from the name it was created with, and then never
 * changes. It is what a filter link carries, so a rename that moved it would
 * quietly empty every board somebody had bookmarked.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

const typeInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Give the type a name").max(40),
  icon: z.string().trim().min(1),
  tone: z.string().trim().min(1),
  position: z.coerce.number().int().min(0).max(999),
});

function parseType(formData: FormData) {
  return typeInput.safeParse({
    id: formData.get("typeId") || undefined,
    name: formData.get("name"),
    icon: formData.get("icon"),
    tone: formData.get("tone"),
    position: formData.get("position") || 0,
  });
}

export async function createTaskType(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  await assertCanAdminister(viewer);

  const parsed = parseType(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { name, icon, tone, position } = parsed.data;

  const slug = slugify(name);
  if (!slug) return { error: "That name has no letters or numbers in it." };

  const [taken] = await db.select({ id: taskTypes.id }).from(taskTypes).where(eq(taskTypes.slug, slug));
  if (taken) return { error: `There is already a type called something like "${name}".` };

  await db.insert(taskTypes).values({ slug, name, icon, tone, position });

  refresh();
  redirect("/admin/task-types");
}

export async function updateTaskType(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  await assertCanAdminister(viewer);

  const parsed = parseType(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { id, name, icon, tone, position } = parsed.data;
  if (!id) return { error: "That type no longer exists." };

  const [clash] = await db
    .select({ id: taskTypes.id })
    .from(taskTypes)
    .where(and(sql`lower(${taskTypes.name}) = ${name.toLowerCase()}`, ne(taskTypes.id, id)));
  if (clash) return { error: `Another type is already called "${name}".` };

  // The slug stays as it was. See `slugify`.
  await db.update(taskTypes).set({ name, icon, tone, position }).where(eq(taskTypes.id, id));

  refresh();
  redirect("/admin/task-types");
}

/**
 * Retire a kind, or bring it back.
 *
 * Never a delete: `tasks.type_id` is `on delete restrict`, so a kind anything
 * has ever been filed under cannot be removed — and should not be. Retiring
 * takes it out of the pickers and leaves the work that wears it alone.
 */
export async function setTaskTypeRetired(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await requireUser();
  await assertCanAdminister(viewer);

  const parsed = retireInput.safeParse({ id: formData.get("typeId") });
  if (!parsed.success) return { error: "That type no longer exists." };

  const retire = formData.get("retire") === "1";

  if (retire) {
    /*
     * Not the last one. A task must have a kind, and a picker with nothing in
     * it is a form nobody can submit.
     */
    const [{ live }] = await db
      .select({ live: sql<number>`count(*)::int` })
      .from(taskTypes)
      .where(sql`${taskTypes.archivedAt} is null and ${taskTypes.id} <> ${parsed.data.id}::uuid`);
    if (live === 0) return { error: "This is the last task type. There has to be one." };
  }

  await db
    .update(taskTypes)
    .set({ archivedAt: retire ? new Date() : null })
    .where(eq(taskTypes.id, parsed.data.id));

  refresh();
  redirect("/admin/task-types");
}
