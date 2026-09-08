"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";

/**
 * Follow a notification to the thing it is about, marking it read on the way.
 *
 * A form rather than a link, so it is one round trip and works without
 * JavaScript. Reading and navigating are the same gesture — nobody opens their
 * inbox to mark things read.
 */
export async function openNotification(formData: FormData) {
  const id = String(formData.get("notificationId") ?? "");
  const user = await requireUser();

  const [row] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    // The owner is in the WHERE clause, not checked after the fact: someone
    // else's id must not be markable, and must not report whether it exists.
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .returning({ taskId: notifications.taskId });

  if (!row) notFound();

  revalidatePath("/", "layout");
  redirect(`/tasks/${row.taskId}`);
}

export async function markAllRead() {
  const user = await requireUser();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
}
