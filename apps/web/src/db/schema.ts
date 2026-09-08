import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
  foreignKey,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", [
  "team_member",
  "account_director",
  "senior_director",
]);

/**
 * What a status *means* to the rest of the system, as opposed to what it is
 * called. An Account Director can name a column anything; these three kinds
 * are the only thing any query is allowed to reason about.
 *
 * This is what keeps custom statuses from breaking reporting. Completion is
 * `completed_at` and always was — a status marked `done` is what stamps it.
 * Without a declared kind, "how did last Tuesday go?" would have as many
 * answers as there are boards.
 */
export const statusKindEnum = pgEnum("status_kind", ["open", "done", "blocked"]);


export const priorityEnum = pgEnum("priority", ["normal", "high", "urgent"]);

export const taskTypeEnum = pgEnum("task_type", [
  "client_work",
  "internal",
  "admin",
  "review",
  "meeting",
  "creative",
]);

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Set after users exist; the FK is added in a follow-up migration statement
  // because users.team_id -> teams.id and teams.account_director_id -> users.id
  // form a cycle.
  accountDirectorId: uuid("account_director_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("team_member"),
    // Null for the Senior Director, who sits above both teams.
    teamId: uuid("team_id").references(() => teams.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("users_team_idx").on(t.teamId)],
);

/**
 * A board belongs to a team and is created by its Account Director. It is a
 * container, not a view: work lives on exactly one board.
 */
export const boards = pgTable(
  "boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("boards_team_idx").on(t.teamId),
    unique("boards_team_name_key").on(t.teamId, t.name),
    // Lets `tasks` carry a composite key proving its team matches its board's.
    unique("boards_id_team_key").on(t.id, t.teamId),
  ],
);

/** A column on a board. Named by whoever made it, typed by `kind`. */
export const boardStatuses = pgTable(
  "board_statuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: statusKindEnum("kind").notNull().default("open"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("board_statuses_board_idx").on(t.boardId),
    unique("board_statuses_board_name_key").on(t.boardId, t.name),
    // Lets `tasks` carry a composite key proving the status is on its board.
    unique("board_statuses_id_board_key").on(t.id, t.boardId),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    type: taskTypeEnum("type").notNull().default("internal"),
    priority: priorityEnum("priority").notNull().default("normal"),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id),
    statusId: uuid("status_id")
      .notNull()
      .references(() => boardStatuses.id),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    /*
     * Effort, in minutes. Nullable because most work is never estimated, and
     * zero is a real answer that must not be confused with "nobody said".
     * Parsed and rendered by `lib/duration.ts`, where a day is eight hours.
     */
    estimateMinutes: integer("estimate_minutes"),
    /**
     * The sum of this task's `time_logged` activity, kept here so a list or a
     * report can read a total without summing a stream. Written only by the
     * actions that add or remove a log entry, in the same transaction — never
     * typed, because an actual is a record of what happened rather than a
     * second guess alongside the estimate.
     */
    actualMinutes: integer("actual_minutes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    // Source of truth for reporting. Stamped when status becomes "done",
    // cleared when it moves off "done".
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tasks_due_idx").on(t.dueDate),
    index("tasks_team_due_idx").on(t.teamId, t.dueDate),
    index("tasks_completed_idx").on(t.completedAt),
    index("tasks_board_idx").on(t.boardId),
    /*
     * Two composite keys the database enforces so nothing else has to:
     * a task's team always matches its board's team, and its status always
     * belongs to its own board. `team_id` stays denormalised because every
     * report scopes on it, and this is what keeps that copy honest.
     */
    foreignKey({
      columns: [t.boardId, t.teamId],
      foreignColumns: [boards.id, boards.teamId],
      name: "tasks_board_team_fk",
    }),
    foreignKey({
      columns: [t.statusId, t.boardId],
      foreignColumns: [boardStatuses.id, boardStatuses.boardId],
      name: "tasks_status_board_fk",
    }),
  ],
);

export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.userId] }),
    index("task_assignees_user_idx").on(t.userId),
  ],
);

/**
 * A file on a task. The row is the record; the bytes live in object storage
 * under `key`. Nothing is ever served from the bucket directly — reads go
 * through a route that checks the same permission as the task itself.
 */
export const taskAttachments = pgTable(
  "task_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    // Object key in the bucket. Unique so a retried upload cannot leave two
    // rows pointing at the same bytes.
    key: text("key").notNull().unique(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("task_attachments_task_idx").on(t.taskId)],
);

export const activityKindEnum = pgEnum("activity_kind", [
  "comment",
  "time_logged",
  "created",
  "status_changed",
  "completed",
  "reopened",
  "assigned",
  "unassigned",
  "board_changed",
]);

/**
 * One task's history: what people said and what happened, in one stream.
 *
 * One table rather than comments and events kept apart. The feed is a single
 * ordered list, and two tables would mean a UNION ordered by time on every
 * read — the shape that gets slow and awkward exactly as it grows.
 *
 * Event detail is *snapshotted as text*, never referenced. `fromLabel` and
 * `toLabel` hold a column's name as it read at the time. An Account Director
 * can rename a column or delete it outright, and `deleteColumn` only checks
 * whether tasks sit in it *now* — so a foreign key here would either block
 * that delete or cascade the history away. "Sarah moved this to In Progress"
 * has to keep reading correctly afterwards. The docs feature made the same
 * call, denormalising a document's title into its mention chip.
 */
export const taskActivity = pgTable(
  "task_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    // No cascade: people are not deleted out from under the record of what
    // they did.
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    kind: activityKindEnum("kind").notNull(),
    /** BlockNote JSON on a comment, and the optional note on a time log. */
    body: text("body"),
    /**
     * Minutes, on `time_logged` only. The log is the record of actual effort;
     * `tasks.actual_minutes` is the sum of these and is maintained alongside
     * them, never typed.
     */
    minutes: integer("minutes"),
    fromLabel: text("from_label"),
    toLabel: text("to_label"),
    /** Who an assignment was about, as their name read at the time. */
    subjectName: text("subject_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("task_activity_task_idx").on(t.taskId, t.createdAt)],
);

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
});

export const taskTags = pgTable(
  "task_tags",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.tagId] })],
);

/**
 * Reference material: the standing instructions a task points at rather than
 * restates. A document is either the whole department's or one team's, and it
 * can parent others — the tree is the only structure there is, because a doc
 * that lives in two places is a doc nobody can find.
 */
export const docVisibilityEnum = pgEnum("doc_visibility", ["org", "team"]);

/**
 * How a task came to reference a document. The two are maintained by different
 * writers — an attachment by the attach control, a mention by re-reading the
 * description on every save — so they are separate rows, not one row with a
 * flag. Sharing a row would mean deleting a mention from the prose silently
 * detaches the document, and detaching it resurrects the link on the next save.
 */
export const docLinkSourceEnum = pgEnum("doc_link_source", ["attached", "mentioned"]);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    // A BlockNote document as JSON, exactly as `tasks.description` stores one.
    body: text("body"),
    /*
     * `toPlainText(body)`, written by the action that writes the body. The
     * search index reads this rather than the JSON, and the flattening lives
     * in TypeScript because only TypeScript knows what a block is — a trigger
     * would have to reimplement it and would drift on the first new block type.
     */
    searchText: text("search_text").notNull().default(""),
    /*
     * Visibility is a property of the tree, set at its root: a child always
     * carries its root's values. Per-doc visibility inside a tree makes holes —
     * a team-only child under an org-wide parent is a gap in everyone else's
     * tree and a broken breadcrumb, and the reverse leaks by link.
     */
    visibility: docVisibilityEnum("visibility").notNull(),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    position: integer("position").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "documents_parent_fk",
    }).onDelete("cascade"),
    index("documents_parent_idx").on(t.parentId),
    index("documents_team_idx").on(t.teamId),
    // Org-wide means no team and team-scoped means a team. Enforced here so no
    // query has to defend against the third, meaningless combination.
    check(
      "documents_visibility_team_ck",
      sql`(visibility = 'org') = (team_id is null)`,
    ),
  ],
);

export const taskDocuments = pgTable(
  "task_documents",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    source: docLinkSourceEnum("source").notNull(),
  },
  (t) => [
    // `source` is part of the key: one document can be both attached and
    // mentioned, and each writer owns only its own rows.
    primaryKey({ columns: [t.taskId, t.documentId, t.source] }),
    // The backlink lookup — every task referencing this document.
    index("task_documents_document_idx").on(t.documentId),
  ],
);

export const notificationKindEnum = pgEnum("notification_kind", [
  "mentioned",
  "assigned",
  "commented",
]);

/**
 * What someone still has to look at.
 *
 * A row per recipient, written when the thing happens, rather than a feed
 * derived at read time. Read state is per person, so there is no version of
 * this without a row each — and `assigned` could not be derived at all:
 * `task_activity` records the assignee as `subject_name`, a text snapshot,
 * with no id to match a reader against.
 *
 * This is a nudge, not history. `task_activity` is the record of what
 * happened and outlives everything; a notification exists only until it has
 * done its job, which is why it cascades away so freely below.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Who is being told. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Who caused it. Never the same as `user_id` — you are not told about
     * your own doing.
     *
     * This cascades, and `task_activity.actor_id` deliberately does not. That
     * table is the record of what someone did and must survive them; this one
     * is a note on a desk.
     */
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    /**
     * The comment or event this came from, when there was one. Null for a
     * mention added by editing a description, which writes no activity row.
     *
     * The cascade is the point: delete the comment and the notification
     * pointing at it goes with it, rather than surviving as a link to
     * something no longer there.
     */
    activityId: uuid("activity_id").references(() => taskActivity.id, {
      onDelete: "cascade",
    }),
    kind: notificationKindEnum("kind").notNull(),
    /** Null is unread. A timestamp, not a boolean, so *when* survives too. */
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // The inbox read, and the unread count, are both this index.
    index("notifications_inbox_idx").on(t.userId, t.createdAt),
    /*
     * One telling per person per event, so a retried action cannot notify
     * twice. Postgres treats nulls as distinct, so this does not constrain a
     * description mention (`activity_id` null) — those are kept idempotent by
     * diffing the old body against the new in `updateTask`, which is the
     * better answer anyway: editing a typo should not re-ping the room.
     */
    uniqueIndex("notifications_once_idx").on(t.userId, t.activityId, t.kind),
  ],
);

export type Role = (typeof roleEnum.enumValues)[number];
export type StatusKind = (typeof statusKindEnum.enumValues)[number];
export type ActivityKind = (typeof activityKindEnum.enumValues)[number];
export type Activity = typeof taskActivity.$inferSelect;
export type Priority = (typeof priorityEnum.enumValues)[number];
export type TaskType = (typeof taskTypeEnum.enumValues)[number];

export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type DocVisibility = (typeof docVisibilityEnum.enumValues)[number];
export type DocLinkSource = (typeof docLinkSourceEnum.enumValues)[number];
export type Doc = typeof documents.$inferSelect;
export type NotificationKind = (typeof notificationKindEnum.enumValues)[number];
export type Notification = typeof notifications.$inferSelect;
