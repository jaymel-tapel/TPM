"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  priorityEnum,
  taskAssignees,
  taskStatusEnum,
  taskTags,
  taskTypeEnum,
  tags,
  tasks,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { assertCanViewUser, loadEditableTask } from "@/lib/permissions";

const taskInput = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200),
  // A BlockNote document, not prose: the cap is a sanity limit on the JSON,
  // not a word count. Images live in object storage and appear here only as a
  // URL, so a long description is long because someone wrote a lot.
  description: z.string().trim().max(200_000).optional().nullable(),
  type: z.enum(taskTypeEnum.enumValues),
  priority: z.enum(priorityEnum.enumValues),
  status: z.enum(taskStatusEnum.enumValues),
  /** datetime-local value, read in the browser's own zone. */
  dueDate: z.string().min(1, "Pick a due date"),
  assignees: z.array(z.string().uuid()).min(1, "Assign the task to someone"),
  tags: z.array(z.string().trim()).default([]),
});

function parse(formData: FormData) {
  return taskInput.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    type: formData.get("type"),
    priority: formData.get("priority"),
    status: formData.get("status") ?? "todo",
    dueDate: formData.get("dueDate"),
    assignees: formData.getAll("assignees").map(String),
    tags: formData
      .getAll("tags")
      .map(String)
      .filter(Boolean),
  });
}

/** Tags are a small shared vocabulary — created on first use, never managed. */
async function linkTags(taskId: string, names: string[]) {
  await db.delete(taskTags).where(eq(taskTags.taskId, taskId));
  if (names.length === 0) return;

  const existing = await db.query.tags.findMany({ where: inArray(tags.name, names) });
  const known = new Map(existing.map((t) => [t.name, t.id]));
  const missing = names.filter((n) => !known.has(n));

  if (missing.length > 0) {
    const created = await db
      .insert(tags)
      .values(missing.map((name) => ({ name })))
      .onConflictDoNothing()
      .returning();
    for (const t of created) known.set(t.name, t.id);
  }

  const rows = names
    .map((n) => known.get(n))
    .filter((id): id is string => Boolean(id))
    .map((tagId) => ({ taskId, tagId }));
  if (rows.length > 0) await db.insert(taskTags).values(rows).onConflictDoNothing();
}

function refresh() {
  revalidatePath("/", "layout");
}

export type FormState = { error?: string } | null;

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const input = parsed.data;

  // The task belongs to the team the work is being done by.
  const first = await assertCanViewUser(viewer, input.assignees[0]);
  const teamId = first.teamId ?? viewer.teamId;
  if (!teamId) return { error: "Assign the task to someone on a team." };

  const [task] = await db
    .insert(tasks)
    .values({
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      priority: input.priority,
      status: input.status,
      dueDate: new Date(input.dueDate),
      completedAt: input.status === "done" ? new Date() : null,
      createdBy: viewer.id,
      teamId,
    })
    .returning();

  await db
    .insert(taskAssignees)
    .values(input.assignees.map((userId) => ({ taskId: task.id, userId })));
  await linkTags(task.id, input.tags);

  refresh();
  redirect(`/tasks/${task.id}`);
}

export async function updateTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const existing = await loadEditableTask(viewer, taskId);

  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const input = parsed.data;

  await db
    .update(tasks)
    .set({
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      priority: input.priority,
      status: input.status,
      dueDate: new Date(input.dueDate),
      completedAt: completionStamp(input.status, existing.completedAt),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
  await db
    .insert(taskAssignees)
    .values(input.assignees.map((userId) => ({ taskId, userId })));
  await linkTags(taskId, input.tags);

  refresh();
  redirect(`/tasks/${taskId}`);
}

/**
 * `completed_at` is what every report reads, so it is stamped on the way into
 * "done" and cleared on the way out — never left stale.
 */
function completionStamp(status: string, current: Date | null): Date | null {
  if (status === "done") return current ?? new Date();
  return null;
}

/** The one-click affordance on every task row. */
export async function toggleTaskDone(formData: FormData) {
  const viewer = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const task = await loadEditableTask(viewer, taskId);

  const done = task.status === "done";
  await db
    .update(tasks)
    .set({
      status: done ? "todo" : "done",
      completedAt: done ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  refresh();
}

export async function setTaskStatus(formData: FormData) {
  const viewer = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const status = z.enum(taskStatusEnum.enumValues).parse(formData.get("status"));
  const task = await loadEditableTask(viewer, taskId);

  await db
    .update(tasks)
    .set({
      status,
      completedAt: completionStamp(status, task.completedAt),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  refresh();
}

export async function deleteTask(formData: FormData) {
  const viewer = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  await loadEditableTask(viewer, taskId);
  await db.delete(tasks).where(eq(tasks.id, taskId));
  refresh();
  redirect("/today");
}
