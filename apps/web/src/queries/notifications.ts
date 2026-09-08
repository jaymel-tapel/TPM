import "server-only";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { toPlainText } from "@meridian/ui/editor";
import { db } from "@/db";
import { notifications, type NotificationKind, type Task } from "@/db/schema";

export type InboxEntry = {
  id: string;
  kind: NotificationKind;
  actorName: string;
  taskId: string;
  taskTitle: string;
  /** One line of the comment, already flattened — never a document to render. */
  excerpt: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/** Long enough to recognise the message, short enough for one line. */
const EXCERPT = 140;

/**
 * Of these people, the ones who may actually see this task.
 *
 * The ids reaching this function came out of a `@` mention in a body the
 * browser sent, so they are the author's *claim* about who they meant, not a
 * fact — the same reasoning `syncMentionedDocs` applies to document ids. A
 * hand-written payload can name any user in the department, and every person
 * it names would otherwise receive the task's title in their inbox. So
 * `@`-mentioning would become a way to push text at anyone in the company and
 * to leak the titles of another team's work.
 *
 * This must agree with `canViewTask` exactly. Where they disagree, the inbox
 * advertises a door that does not open — the failure `canViewTeam` and
 * `canViewTeamWork` were split apart to prevent. `notifications.test.ts` pins
 * the two together.
 */
export async function filterUsersWhoCanSeeTask(
  task: Task,
  userIds: string[],
): Promise<string[]> {
  if (userIds.length === 0) return [];

  // Expanded into placeholders rather than bound as one array: the driver
  // sends a JS array as a single parameter, which Postgres then tries to read
  // as an array literal and refuses.
  const list = sql.join(
    userIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );

  const result = await db.execute(sql`
    select u.id from users u
    where u.id in (${list}) and (
      u.role = 'senior_director'
      -- Work with no team is the department's, and everybody is in the
      -- department. Comparing a column to NULL is never true, so without this
      -- a mention on a department board would notify nobody while
      -- canViewTask said the whole department could read it.
      or ${task.teamId === null ? sql`true` : sql`u.team_id = ${task.teamId}`}
      or u.id = ${task.createdBy}
      or exists (
        select 1 from task_assignees a
        where a.task_id = ${task.id} and a.user_id = u.id
      )
    )
  `);
  return (result.rows as unknown as { id: string }[]).map((r) => r.id);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.total ?? 0;
}

/**
 * Someone's inbox, newest first.
 *
 * The excerpt is flattened here rather than handed over as BlockNote JSON.
 * `RichTextView` mounts a whole editor per call — the cost that capped the
 * activity feed at twenty — and an inbox row wants one line of text, so
 * `toPlainText` is both cheaper and the right shape. It renders `@Name`
 * correctly, so a mention still reads as a mention.
 */
export async function getInbox(userId: string, limit = 50): Promise<InboxEntry[]> {
  const result = await db.execute(sql`
    select
      n.id,
      n.kind,
      actor.name as actor_name,
      n.task_id,
      k.title as task_title,
      a.body as body,
      n.read_at,
      n.created_at
    from notifications n
    join users actor on actor.id = n.actor_id
    join tasks k on k.id = n.task_id
    left join task_activity a on a.id = n.activity_id
    where n.user_id = ${userId}
    order by n.created_at desc, n.id desc
    limit ${limit}
  `);

  type Row = {
    id: string;
    kind: NotificationKind;
    actor_name: string;
    task_id: string;
    task_title: string;
    body: string | null;
    /*
     * Strings, not Dates. Drizzle replaces node-postgres' timestamp parsers so
     * its query builder can map them itself, which leaves a raw `db.execute`
     * handing back whatever Postgres printed. Anything reading these has to
     * make the Date, or it gets a string that answers to nothing.
     */
    read_at: string | null;
    created_at: string;
  };

  return (result.rows as unknown as Row[]).map((r) => {
    const text = r.body ? toPlainText(r.body) : "";
    return {
      id: r.id,
      kind: r.kind,
      actorName: r.actor_name,
      taskId: r.task_id,
      taskTitle: r.task_title,
      excerpt: text ? text.slice(0, EXCERPT) : null,
      readAt: r.read_at === null ? null : new Date(r.read_at),
      createdAt: new Date(r.created_at),
    };
  });
}
