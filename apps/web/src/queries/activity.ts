import "server-only";
import { asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskActivity, users, type ActivityKind } from "@/db/schema";

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  actorId: string;
  actorName: string;
  body: string | null;
  minutes: number | null;
  fromLabel: string | null;
  toLabel: string | null;
  subjectName: string | null;
  createdAt: Date;
};

export type ActivityPage = {
  entries: ActivityEntry[];
  /** Everything on the task, so the UI can say how much it is not showing. */
  total: number;
};

/**
 * Reading a comment costs a whole editor instance — `RichTextView` mounts its
 * own BlockNote — so the feed is capped by default rather than rendering every
 * comment a long-running task ever collected. Events are cheap; the cap is
 * about the comments among them.
 */
export const ACTIVITY_PAGE = 20;

export async function getActivity(
  taskId: string,
  limit: number | null = ACTIVITY_PAGE,
): Promise<ActivityPage> {
  const columns = {
    id: taskActivity.id,
    kind: taskActivity.kind,
    actorId: taskActivity.actorId,
    actorName: users.name,
    body: taskActivity.body,
    minutes: taskActivity.minutes,
    fromLabel: taskActivity.fromLabel,
    toLabel: taskActivity.toLabel,
    subjectName: taskActivity.subjectName,
    createdAt: taskActivity.createdAt,
  };

  /*
   * How many there are, and the page itself — together. The count does not
   * gate the page: `limit` decides how much to fetch, and the total is only
   * ever displayed beside it.
   */
  const page = db
    .select(columns)
    .from(taskActivity)
    .innerJoin(users, eq(users.id, taskActivity.actorId))
    .where(eq(taskActivity.taskId, taskId));

  const [[{ total }], entries] = await Promise.all([
    db
      .select({ total: count() })
      .from(taskActivity)
      .where(eq(taskActivity.taskId, taskId)),

    limit === null
      ? page.orderBy(asc(taskActivity.createdAt), asc(taskActivity.id))
      : // Newest N, then flipped: a feed reads oldest-first, but "most recent"
        // is what you want to keep when you cannot keep everything.
        //
        // `defaultNow()` is transaction time, so rows written together — three
        // assignment changes in one save — share a timestamp to the
        // microsecond. Without the id as tiebreak their order is undefined and
        // the page boundary can drop or repeat one.
        page
          .orderBy(desc(taskActivity.createdAt), desc(taskActivity.id))
          .limit(limit)
          .then((rows) => rows.reverse()),
  ]);

  return { entries, total };
}
