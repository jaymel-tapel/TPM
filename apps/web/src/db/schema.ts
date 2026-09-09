import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  date,
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
 * What a column *does*, as opposed to what it is called.
 *
 * `done` names a board's finish line — the column that marks work complete
 * when something lands in it. It does not mean "finished work lives here", and
 * a task does not stop being complete by leaving. Completion is
 * `tasks.completed_at`, set by finishing the task, and that is the only thing
 * any report reads.
 *
 * The distinction is what lets a board be
 * `Brief → Design → Client review → Approved → Delivered` rather than three
 * columns: the stages are the workflow, and exactly one of them is where work
 * is considered done.
 *
 * `blocked` is the brief's exceptional state and is counted by Needs
 * Attention. Everything else is `open` — an ordinary stage.
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

/**
 * A client the department works for, and the unit everything else is scoped
 * by — its boards, its tasks, its documents, its people.
 *
 * Exactly one Account Director, because somebody has to be answerable for a
 * client; one person may direct several. Who *works* on the account is the
 * many-to-many below, and it is deliberately a different question: a director
 * runs three accounts, a designer works on two, and neither fact is derivable
 * from the other.
 */
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  // Set after users exist; the FK is added in a follow-up migration statement
  // because account_members.user_id -> users.id and
  // accounts.account_director_id -> users.id would otherwise need users first.
  accountDirectorId: uuid("account_director_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Who works on an account.
 *
 * This table is the whole point of the shape. Agency people are shared — a
 * designer covers two clients, a copywriter one, an Account Director three —
 * and a single `users.account_id` could only ever tell one of those stories.
 * Every permission in the app reads membership through here.
 *
 * Membership is not assignment. Belonging to Volvo says you may see Volvo's
 * work; being on a task says the work is yours.
 */
export const accountMembers = pgTable(
  "account_members",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.userId] }),
    // Every page asks "which accounts is this person on" before it asks
    // anything else, so the reverse direction earns its own index.
    index("account_members_user_idx").on(t.userId),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("team_member"),
    /*
     * What they do, in their own words — "Designer", "Copywriter", "Paid
     * Media". A craft is a fact about the person, not about one client, so it
     * sits here rather than on the membership row: nobody is a designer on
     * Volvo and something else on MG. Null until somebody fills it in.
     */
    title: text("title"),
    /*
     * How this person reckons a day.
     *
     * Null means the department's default. Set, it decides where *their* day
     * begins and ends — and therefore what "due today", "overdue" and
     * "completed on time" mean on every screen they open. Two people in
     * different zones can honestly disagree about whether the same task was
     * late; the day boundary belongs to the reader, not to the row.
     */
    timezone: text("timezone"),
    /** The hours the day plan opens on. Null means the department default. */
    workStartHour: integer("work_start_hour"),
    workEndHour: integer("work_end_hour"),
    /**
     * When the password last changed. A session is a signed cookie, so
     * changing the hash alone would not end one — the person stays signed in
     * on whatever device they are on until it expires, which is exactly what a
     * reset is meant to stop. Tokens issued before this are refused.
     */
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

/**
 * A board is a container, not a view: work lives on exactly one board.
 *
 * `account_id` is null for a board that belongs to the department rather than
 * to a client — a company retro, a tool trial, anything that is nobody's
 * client work. Only the Senior Director creates those; an Account Director's
 * boards belong to an account they direct.
 *
 * The consequence, stated because it is easy to miss: work with no account is
 * visible to everyone. An account's board is scoped by the account; a board
 * with no account has nothing to scope by, so the department is the scope.
 */
export const boards = pgTable(
  "boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("boards_account_idx").on(t.accountId),
    /*
     * Two names cannot collide inside one account. Postgres treats nulls as
     * distinct in a unique constraint, so this says nothing about the
     * department's own boards — `uniqueIndex` below covers those.
     */
    unique("boards_account_name_key").on(t.accountId, t.name),
    uniqueIndex("boards_root_name_key")
      .on(t.name)
      .where(sql`account_id is null`),
    /*
     * Lets `tasks` carry a composite key proving its account matches its
     * board's.
     *
     * That proof lapses for the department's own boards: a composite foreign
     * key is satisfied automatically when any of its columns is null, so a
     * task with no account is not checked against its board. `createTask` and
     * `updateTask` copy the board's account either way, and a test pins it.
     */
    unique("boards_id_account_key").on(t.id, t.accountId),
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

export const campaignStatusEnum = pgEnum("campaign_status", [
  "planned",
  "live",
  "wrapped",
]);

/**
 * A time-boxed push inside one account — "Summer Launch", "Volvo Run Club".
 *
 * Deliberately shallow. A campaign holds tasks and nothing else: no phases, no
 * sub-campaigns, no per-campaign fields. It exists to give a fortnight of work
 * a name and a deadline, which is the thing a tag could never do because a tag
 * has no dates and no end.
 *
 * The dates are `date` columns rather than timestamps, the same choice
 * `leave_requests` makes and for the same reason: "Q4 ends on 30 November" has
 * to be true for the director reading it in London and the designer reading it
 * in Manila, or a schedule is a rumour.
 */
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    status: campaignStatusEnum("status").notNull().default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("campaigns_account_idx").on(t.accountId),
    unique("campaigns_account_name_key").on(t.accountId, t.name),
    // The target of the composite key on `tasks` that proves a task's campaign
    // and its account agree.
    unique("campaigns_id_account_key").on(t.id, t.accountId),
    check("campaigns_range_ck", sql`ends_on >= starts_on`),
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
    /**
     * Where the card sits in its column, low first. Only the board reads it;
     * every list is still ordered by priority and due date, which is what
     * those screens are for.
     *
     * Zero is not a rank — it is "nobody has placed this", and `boardOrder`
     * sorts it *after* everything placed. A task arrives at zero and stays
     * there until somebody drags it, so an untouched column keeps the order it
     * has always had, and work joining an arranged column cannot land on top
     * of the arrangement.
     */
    position: integer("position").notNull().default(0),
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
    /*
     * Null on work that belongs to the department rather than to a client,
     * which is to say work on a board with no account. Every account-scoped
     * query compares `account_id = <an account>`, so these rows fall out of
     * account rollups on their own; the department's own totals count them,
     * and `canViewTask` lets everybody read them.
     */
    accountId: uuid("account_id").references(() => accounts.id),
    /*
     * The campaign this work is part of, if any. Most work is not — a
     * retainer's monthly reporting belongs to the account and to nothing
     * smaller.
     *
     * `set null` rather than cascade: wrapping up a campaign must not delete
     * the work done for it. The composite key below proves the campaign and
     * the task belong to the same account, so a Volvo task can never carry an
     * MG campaign.
     */
    campaignId: uuid("campaign_id"),
    /*
     * The task this one is a piece of. Null for ordinary work.
     *
     * A task with children is a *container*: its children are the units of
     * work, and it is counted nowhere itself. Without that rule "3 of 5 done
     * today" would move whenever somebody reorganised rather than when they
     * finished something — a number you improve by splitting things up.
     *
     * Pieces may have pieces. Depth is a cross-row property Postgres cannot
     * express without a trigger, so `createSubtask` checks it and stops at
     * `MAX_SUBTASK_DEPTH` — a readability limit, not a structural one.
     *
     * The container rule is what makes depth safe: only leaves are work, at
     * any level, so a deeper tree never changes what a day counts. Contrast
     * `folders`, where nesting was removed in 0008 — a document was both a
     * thing you open and a thing that holds other things, and "open" and
     * "expand" fought over the same row. A container here holds and is never
     * itself the work, so the two never compete.
     */
    parentId: uuid("parent_id"),
    // Source of truth for reporting, and the task's own fact. Set by finishing
    // the work; landing on a board's finish line is one way to do that.
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
    index("tasks_account_due_idx").on(t.accountId, t.dueDate),
    index("tasks_completed_idx").on(t.completedAt),
    index("tasks_board_idx").on(t.boardId),
    // Read by every board render, and by the re-rank a drop performs.
    index("tasks_status_position_idx").on(t.statusId, t.position),
    // Read by `isLeaf`, which runs on every list and count in the product.
    index("tasks_parent_idx").on(t.parentId),
    index("tasks_campaign_idx").on(t.campaignId),
    /*
     * Declared here rather than inline, the way `folders_parent_fk` is: a
     * self-reference cannot name its own table from the column definition.
     * Cascading because a subtask has no life of its own — "Slides" with no
     * presentation to belong to is not work anybody could act on.
     */
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "tasks_parent_fk",
    }).onDelete("cascade"),
    /*
     * Three composite keys the database enforces so nothing else has to: a
     * task's account always matches its board's, its status always belongs to
     * its own board, and its campaign always belongs to its own account.
     * `account_id` stays denormalised because every report scopes on it, and
     * these are what keep that copy honest.
     */
    foreignKey({
      columns: [t.boardId, t.accountId],
      foreignColumns: [boards.id, boards.accountId],
      name: "tasks_board_account_fk",
    }),
    foreignKey({
      columns: [t.statusId, t.boardId],
      foreignColumns: [boardStatuses.id, boardStatuses.boardId],
      name: "tasks_status_board_fk",
    }),
    foreignKey({
      columns: [t.campaignId, t.accountId],
      foreignColumns: [campaigns.id, campaigns.accountId],
      name: "tasks_campaign_account_fk",
    }),
    /*
     * A composite foreign key is satisfied automatically when any of its
     * columns is null, so the key above says nothing about a task with no
     * account. This closes that hole: department work has no client, and so
     * cannot be part of a client's campaign.
     */
    check(
      "tasks_campaign_needs_account_ck",
      sql`campaign_id is null or account_id is not null`,
    ),
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
 * restates. A document is either the whole department's or one account's, and it
 * can parent others — the tree is the only structure there is, because a doc
 * that lives in two places is a doc nobody can find.
 */
export const docVisibilityEnum = pgEnum("doc_visibility", ["org", "account"]);

/**
 * How a task came to reference a document. The two are maintained by different
 * writers — an attachment by the attach control, a mention by re-reading the
 * description on every save — so they are separate rows, not one row with a
 * flag. Sharing a row would mean deleting a mention from the prose silently
 * detaches the document, and detaching it resurrects the link on the next save.
 */
export const docLinkSourceEnum = pgEnum("doc_link_source", ["attached", "mentioned"]);

/**
 * A place to put documents. Folders nest; documents do not.
 *
 * The first cut let a document contain other documents, which is the model
 * Notion uses and the one people trip over: a thing you click to read is also
 * a thing that holds other things, so "open" and "expand" fight over the same
 * row. A folder holds and a document says something, and neither does the
 * other's job.
 *
 * Visibility works exactly as it does on a document, and for the same reason:
 * it belongs to the whole tree and is copied down on every move, so a query
 * never has to walk upwards to find out who may read a row.
 */
export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    parentId: uuid("parent_id"),
    visibility: docVisibilityEnum("visibility").notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "folders_parent_fk",
    }).onDelete("cascade"),
    index("folders_parent_idx").on(t.parentId),
    index("folders_account_idx").on(t.accountId),
    check(
      "folders_visibility_account_ck",
      sql`(visibility = 'org') = (account_id is null)`,
    ),
  ],
);

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
     * an account-only child under an org-wide parent is a gap in everyone else's
     * tree and a broken breadcrumb, and the reverse leaks by link.
     */
    visibility: docVisibilityEnum("visibility").notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    /** The folder it lives in, or null for one sitting at the top level. */
    folderId: uuid("folder_id").references(() => folders.id, { onDelete: "cascade" }),
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
    index("documents_folder_idx").on(t.folderId),
    index("documents_account_idx").on(t.accountId),
    // Org-wide means no account and account-scoped means an account. Enforced here so no
    // query has to defend against the third, meaningless combination.
    check(
      "documents_visibility_account_ck",
      sql`(visibility = 'org') = (account_id is null)`,
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

/**
 * When somebody means to do a task, as opposed to when it is due.
 *
 * Keyed by person, like `task_assignees`, and for the same reason: a task is
 * one row of work but two people's afternoons. A `scheduled_at` column on
 * `tasks` would let Anna's plan overwrite James's on a task they share.
 *
 * A plan is private and disposable. It records an intention, never a fact —
 * `due_date` is still the deadline and `completed_at` is still what reporting
 * reads, and nothing here touches either.
 */
export const taskSchedule = pgTable(
  "task_schedule",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** When this person means to start. Snapped to a quarter hour. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    /**
     * How much of the day they are giving it — deliberately not
     * `tasks.estimate_minutes`. An estimate is how much effort the work takes;
     * a block is how much room you are making for it, and the two disagree all
     * the time. It also has to work when there is no estimate, which for now
     * is always.
     */
    minutes: integer("minutes").notNull(),
  },
  (t) => [
    /*
     * One place in your day per task, which makes the primary key the feature
     * rather than only a constraint: dragging an already-planned task to a new
     * time is an upsert, so "place it" and "move it" are the same write.
     */
    primaryKey({ columns: [t.taskId, t.userId] }),
    index("task_schedule_day_idx").on(t.userId, t.startsAt),
  ],
);

/**
 * The department's own settings. Exactly one row.
 *
 * The timezone here is the fallback for anyone who has not chosen their own,
 * so moving it moves everybody who never opted out — which is the point of a
 * default rather than a copied value. It used to be an environment variable,
 * which meant changing it needed a deploy and nobody could see what it was.
 */
export const department = pgTable(
  "department",
  {
    /** Always 1. The check constraint is what makes this a settings row. */
    id: integer("id").primaryKey().default(1),
    timezone: text("timezone").notNull(),
    workStartHour: integer("work_start_hour").notNull().default(7),
    workEndHour: integer("work_end_hour").notNull().default(21),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [check("department_single_row_ck", sql`id = 1`)],
);

/**
 * Leave: the days somebody is not at work.
 *
 * A request, not a fact, until somebody above them says so — filed as
 * `pending` and decided by the person above the requester on the org chart.
 * Only an approved row marks anyone away on a roster.
 *
 * What this deliberately does *not* do is touch a number. Completion stays
 * "tasks due that day, completed by end of that day", defined once in
 * `queries/reports.ts`; leave never removes a task from that denominator and
 * never edits `completed_at`. A person's percentage is quietened on a day they
 * were away because it is not a signal about them, but it is the same
 * percentage. Anything else would give "how did last Tuesday go?" a second
 * answer, which is the one thing the whole reporting model refuses.
 */
export const leaveKindEnum = pgEnum("leave_kind", [
  "vacation",
  "sick",
  "personal",
  "unpaid",
]);

export const leaveStatusEnum = pgEnum("leave_status", [
  "pending",
  "approved",
  "declined",
  "cancelled",
]);

/** Which half of a single day. Null is the whole of it. */
export const leaveHalfEnum = pgEnum("leave_half", ["am", "pm"]);

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: leaveKindEnum("kind").notNull(),
    /*
     * A day, not an instant — the same distinction `actions/schedule.ts` makes
     * about a planned afternoon, and the reason these are `date` rather than
     * `timestamp`. Leave on the 14th is leave on the 14th wherever the reader
     * happens to be; an instant would make a request filed in Manila start on
     * the 13th for somebody in London. `mode: "string"` keeps it a `yyyy-MM-dd`
     * string the whole way through, so no zone is ever applied to it by
     * accident on the way in or out.
     */
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    /** AM or PM on a one-day request. Null means whole days. */
    half: leaveHalfEnum("half"),
    note: text("note"),
    status: leaveStatusEnum("status").notNull().default("pending"),
    /*
     * Who decided, as a live reference rather than a snapshot. This is an
     * approval record, not history the way `task_activity` is — so it may go
     * null when an approver leaves the department, and the request stays valid
     * without them.
     */
    decidedBy: uuid("decided_by").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Both reads are "this person, around these dates": a roster asking who is
    // away today, and a person reading their own list.
    index("leave_user_range_idx").on(t.userId, t.startDate),
    check("leave_range_ck", sql`end_date >= start_date`),
    /*
     * A half day is half of *one* day. Without this, "12-16 Oct, AM" has no
     * meaning and every length calculation downstream has to invent one.
     */
    check("leave_half_single_day_ck", sql`half is null or start_date = end_date`),
  ],
);

export const chatRoomKindEnum = pgEnum("chat_room_kind", ["direct", "channel"]);

/**
 * Somewhere to say something that is not about one task.
 *
 * The brief rules chat out, and is right about what it was aiming at: a chat
 * product bolted onto a task product, with threads and reactions and presence
 * to learn, which is the second-inbox problem the whole brief is written
 * against. It was not aiming at "are we still on for Thursday", which today has
 * nowhere to go and so goes somewhere else — taking the context with it.
 *
 * So messages, not a messaging product. Plain text, two kinds of room, an
 * unread count, and nothing else.
 */
export const chatRooms = pgTable(
  "chat_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: chatRoomKindEnum("kind").notNull(),
    /** Null on a direct room: it is named by whoever is in it. */
    name: text("name"),
    /**
     * The two ids sorted and joined, on a direct room; null on a channel.
     *
     * One conversation per pair, enforced rather than hoped for. Without it,
     * two people who message each other in the same moment get a room each and
     * every reply lands in the one the other is not reading.
     */
    directKey: text("direct_key"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Nulls are distinct in Postgres, so this constrains direct rooms only.
    uniqueIndex("chat_rooms_direct_key").on(t.directKey),
  ],
);

/**
 * Who is in a room, and how far they have read.
 *
 * A cursor, not a row per message per person. `notifications` fans out because
 * a notification is ephemeral and read state is genuinely per-recipient; chat
 * messages are history, like `task_activity`, and a row each would multiply the
 * table by the size of the conversation to answer a question a timestamp
 * answers.
 *
 * Membership is also the whole permission. There is no director override — a
 * director reading a conversation they are not part of is a different product
 * from this one.
 */
export const chatMembers = pgTable(
  "chat_members",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Everything after this, from somebody else, is unread. */
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.roomId, t.userId] }),
    // Every rail badge and room list starts here.
    index("chat_members_user_idx").on(t.userId),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    /** No cascade: a room keeps what was said in it, as history does. */
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    /**
     * Plain text, deliberately.
     *
     * `RichTextView` mounts a whole BlockNote instance per call, which is why
     * the activity feed caps itself at twenty comments. A scrollback cannot pay
     * that per message — and rich text is the first step toward the product the
     * brief refused.
     */
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_room_idx").on(t.roomId, t.createdAt)],
);

export type Role = (typeof roleEnum.enumValues)[number];
export type StatusKind = (typeof statusKindEnum.enumValues)[number];
export type ActivityKind = (typeof activityKindEnum.enumValues)[number];
export type Activity = typeof taskActivity.$inferSelect;
export type Priority = (typeof priorityEnum.enumValues)[number];
export type TaskType = (typeof taskTypeEnum.enumValues)[number];

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type AccountMember = typeof accountMembers.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type CampaignStatus = (typeof campaignStatusEnum.enumValues)[number];
export type Task = typeof tasks.$inferSelect;
export type DocVisibility = (typeof docVisibilityEnum.enumValues)[number];
export type DocLinkSource = (typeof docLinkSourceEnum.enumValues)[number];
export type Doc = typeof documents.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type NotificationKind = (typeof notificationKindEnum.enumValues)[number];
export type Notification = typeof notifications.$inferSelect;
export type PlanBlock = typeof taskSchedule.$inferSelect;
export type Department = typeof department.$inferSelect;
export type ChatRoom = typeof chatRooms.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type LeaveKind = (typeof leaveKindEnum.enumValues)[number];
export type LeaveStatus = (typeof leaveStatusEnum.enumValues)[number];
export type LeaveHalf = (typeof leaveHalfEnum.enumValues)[number];
