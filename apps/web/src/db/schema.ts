import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  index,
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

/**
 * Retired. Still declared so the migration that introduces `status_kind` is
 * unambiguous — dropped on its own in the migration right after, once nothing
 * references it. Do not use.
 */
export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "done",
  "blocked",
]);

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
    /** Retired alongside `taskStatusEnum` in the next migration. Do not use. */
    status: taskStatusEnum("status").notNull().default("todo"),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id),
    statusId: uuid("status_id")
      .notNull()
      .references(() => boardStatuses.id),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
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

export type Role = (typeof roleEnum.enumValues)[number];
export type StatusKind = (typeof statusKindEnum.enumValues)[number];
export type Priority = (typeof priorityEnum.enumValues)[number];
export type TaskType = (typeof taskTypeEnum.enumValues)[number];

export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type DocVisibility = (typeof docVisibilityEnum.enumValues)[number];
export type DocLinkSource = (typeof docLinkSourceEnum.enumValues)[number];
export type Doc = typeof documents.$inferSelect;
