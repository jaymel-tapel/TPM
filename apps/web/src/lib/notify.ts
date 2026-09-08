import "server-only";
import { db } from "@/db";
import { notifications, type NotificationKind, type Task } from "@/db/schema";
import { filterUsersWhoCanSeeTask } from "@/queries/notifications";
import { publishToUsers } from "@/lib/realtime";

/**
 * Tells people about something, once each, and only if they may see it.
 *
 * The sibling of `syncMentionedDocs` in ./doc-links.ts, and for the same
 * reason: the ids arriving here can come from a `@` mention in a body the
 * browser composed, which makes them a claim rather than a fact. Everything
 * goes through `filterUsersWhoCanSeeTask` before a row is written — see the
 * long note there for what that prevents.
 *
 * Returns who was actually told, so a caller making several of these calls in
 * one save can nudge each person once at the end rather than three times.
 */
export async function notify(entry: {
  task: Task;
  actorId: string;
  kind: NotificationKind;
  activityId?: string | null;
  userIds: string[];
}): Promise<string[]> {
  // You are not told about your own doing. Dropped before the visibility
  // query, so mentioning yourself costs nothing.
  const others = [...new Set(entry.userIds)].filter((id) => id !== entry.actorId);
  if (others.length === 0) return [];

  const allowed = await filterUsersWhoCanSeeTask(entry.task, others);
  if (allowed.length === 0) return [];

  await db
    .insert(notifications)
    .values(
      allowed.map((userId) => ({
        userId,
        actorId: entry.actorId,
        taskId: entry.task.id,
        activityId: entry.activityId ?? null,
        kind: entry.kind,
      })),
    )
    // The unique index catches a retried action re-telling the same person
    // about the same comment.
    .onConflictDoNothing();

  return allowed;
}

/**
 * Wake the recipients' browsers.
 *
 * Kept apart from `notify` so it runs *after* the write is settled, and so a
 * save that notifies three different ways sends one nudge per person. A
 * failure here is not a failure of the save — the rows are in the database and
 * will be read on the recipient's next navigation.
 */
export async function deliver(userIds: string[]): Promise<void> {
  await publishToUsers(userIds);
}
