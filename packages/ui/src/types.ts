/** What a task drag carries, so a drop target can ignore files and links. */
export const TASK_DRAG_TYPE = "application/x-meridian-task";

/**
 * The presentational contract.
 *
 * This package renders; it never queries. Everything it needs arrives as plain
 * data, so the design system can be developed, reviewed and rendered in the
 * gallery without a database anywhere near it. The app owns the mapping from
 * its Drizzle rows onto these shapes.
 */

/**
 * What a status means. Boards name their own columns, so this is the only part
 * of a status the design system is allowed to style or reason about — a column
 * called "Shipped" and one called "Done" both render as `done`.
 */
export type StatusKind = "open" | "done" | "blocked";

/** A column on a board, as the UI needs it. */
export type StatusRef = {
  id: string;
  name: string;
  kind: StatusKind;
};
export type TaskType =
  | "client_work"
  | "internal"
  | "admin"
  | "review"
  | "meeting"
  | "creative";
export type Priority = "normal" | "high" | "urgent";
export type Role = "team_member" | "account_director" | "senior_director";

export type Person = { id: string; name: string };

export type ActivityKind =
  | "comment"
  | "time_logged"
  | "created"
  | "status_changed"
  | "completed"
  | "reopened"
  | "assigned"
  | "unassigned"
  | "board_changed";

/**
 * One entry on a task's stream. `when` is already-formatted text, not a date —
 * this package has no clock, so the app resolves "2h ago" on the server the
 * same way it resolves a task's due label.
 */
export type ActivityItemData = {
  id: string;
  kind: ActivityKind;
  actorId: string;
  actorName: string;
  /** BlockNote JSON on a comment, or the optional note on a time entry. */
  body: string | null;
  /** Already formatted — "2h 30m" — because this package has no duration rules. */
  spent: string | null;
  fromLabel: string | null;
  toLabel: string | null;
  subjectName: string | null;
  when: string;
  /** Whether the viewer may remove this one. Decided by the app. */
  removable: boolean;
};

/** One line in someone's inbox. The excerpt is already plain text — an inbox
 *  row is one line, and mounting an editor per row is what capped the feed. */
export type InboxItemData = {
  id: string;
  kind: "mentioned" | "assigned" | "commented";
  actorName: string;
  taskId: string;
  taskTitle: string;
  excerpt: string | null;
  when: string;
  read: boolean;
};

/**
 * One block on the day plan. The app does the date maths and hands over
 * numbers — this package has no clock, and `startMinutes` is minutes from the
 * app day's own midnight so the grid never has to know a timezone.
 */
export type PlanBlockData = {
  taskId: string;
  href: string;
  title: string;
  type: TaskType;
  priority: Priority;
  done: boolean;
  startMinutes: number;
  minutes: number;
  /** "10:00 AM", already formatted. */
  timeText: string;
};

/** One piece a task was broken into. */
export type SubtaskData = {
  id: string;
  href: string;
  title: string;
  done: boolean;
  /** Already formatted; this package has no clock. */
  dueText: string;
  overdue: boolean;
  assignees: Person[];
};

/** One room in the list beside a conversation. */
export type RoomListItemData = {
  id: string;
  href: string;
  title: string;
  kind: "direct" | "channel";
  excerpt: string | null;
  /** Already formatted; this package has no clock. */
  when: string;
  unread: number;
  active: boolean;
};

/** One message in a conversation. */
export type ChatMessageData = {
  id: string;
  authorName: string;
  body: string;
  /** Clock time, already formatted; this package has no clock. */
  when: string;
  mine: boolean;
  /** True when the message above is from the same person, minutes earlier. */
  continues: boolean;
  /**
   * Set on the first message of each day — "Today", "Yesterday", a date. Null
   * on every other message, so the thread draws one divider per day without
   * having to know which day it is.
   */
  dayLabel: string | null;
};

/** What a task row needs. Due text and overdue are resolved by the app, which
 *  owns the clock and the timezone. */
export type TaskRowData = {
  id: string;
  href: string;
  title: string;
  type: TaskType;
  status: StatusRef;
  priority: Priority;
  dueText: string;
  overdue: boolean;
  done: boolean;
  assignees: Person[];
  tags: string[];
  /** How many documents this task references. */
  docs: number;
};

/**
 * Whether somebody is at work, as a row shows it.
 *
 * `label` is already written — this package has no calendar, so "Away until
 * Friday" is the app's sentence, the same seam `TaskRowData.dueText` draws.
 */
export type AvailabilityData = {
  away: "full" | "am" | "pm";
  kind: LeaveKind;
  label: string;
};

export type MemberRowData = {
  id: string;
  /**
   * Null when there is nowhere to go.
   *
   * A team member may open their own day and nobody else's — `assertCanViewUser`
   * refuses the rest — so most rows on their roster are not links. A row that
   * looks clickable and 404s is the rail's old bug in miniature: advertising a
   * door that does not open.
   */
  href: string | null;
  name: string;
  role: Role;
  /** Their craft — "Designer", "Copywriter". Shown instead of the role when set. */
  title?: string | null;
  /** The accounts they work on. Only worth showing where a roster spans them. */
  accounts?: string[];
  due: number;
  done: number;
  overdue: number;
  remaining: number;
  percent: number;
  /**
   * Null when they are in.
   *
   * Shown, never subtracted. A percentage for a day somebody was not working
   * is not a fact about them, so the row quietens it — but it is the same
   * number the rollup counted, because completion has exactly one definition
   * and leave is not allowed to become a second one.
   */
  away?: AvailabilityData | null;
};

export type LeaveKind = "vacation" | "sick" | "personal" | "unpaid";
export type LeaveStatus = "pending" | "approved" | "declined" | "cancelled";

/** A request, with every date already turned into words by the app. */
export type LeaveRequestData = {
  id: string;
  personName: string;
  kind: LeaveKind;
  status: LeaveStatus;
  /** "12–16 Oct" */
  rangeText: string;
  /** "5 days" · "Half day (PM)" */
  lengthText: string;
  /** Withheld from anyone but the filer and whoever decides it. */
  note: string | null;
  /** "Approved by Sarah Lim" · "Waiting on the Senior Director" */
  decisionText: string | null;
  /** Whether this reader may withdraw it. */
  cancellable: boolean;
};

export const LEAVE_KIND_LABELS: Record<LeaveKind, string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  unpaid: "Unpaid",
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const LEAVE_KINDS = Object.keys(LEAVE_KIND_LABELS) as LeaveKind[];
export const LEAVE_STATUSES = Object.keys(LEAVE_STATUS_LABELS) as LeaveStatus[];

export type AttentionItemData = {
  severity: "high" | "medium";
  headline: string;
  detail: string;
  href?: string;
};

export type TrendPointData = {
  label: string;
  percent: number;
  due: number;
  done: number;
};

/* ── Labels. Presentation, so they live with the components. ────────────── */

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  client_work: "Client Work",
  internal: "Internal",
  admin: "Admin",
  review: "Review",
  meeting: "Meeting",
  creative: "Creative",
};

/**
 * Kinds, not statuses. Column names come from the board and are shown as
 * written; these are only for the places that describe a kind in prose.
 */
export const STATUS_KIND_LABELS: Record<StatusKind, string> = {
  open: "Open",
  done: "Done",
  blocked: "Blocked",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  normal: "Normal",
  high: "High Priority",
  urgent: "Urgent",
};

export const ROLE_LABELS: Record<Role, string> = {
  team_member: "Team Member",
  account_director: "Account Director",
  senior_director: "Senior Director",
};

/** Compact badge text where a full role label would not fit. */
export const ROLE_BADGES: Record<Role, string> = {
  team_member: "",
  account_director: "AD",
  senior_director: "SD",
};

export const TASK_TYPES = Object.keys(TASK_TYPE_LABELS) as TaskType[];
export const STATUS_KINDS = Object.keys(STATUS_KIND_LABELS) as StatusKind[];
export const PRIORITIES = Object.keys(PRIORITY_LABELS) as Priority[];

/** Whose a document is, as the reader sees it. */
export type DocScope = "org" | "account";

/** A document, as it sits in the tree. Documents do not contain documents. */
export type DocNodeData = {
  id: string;
  href: string;
  title: string;
  scope: DocScope;
  /** The team's name, or null when the document is everyone's. */
  accountName: string | null;
};

/**
 * A folder: the thing that contains. Folders nest and hold documents, which is
 * the whole distinction — one holds, the other says something.
 */
export type DocFolderData = {
  id: string;
  href: string;
  name: string;
  scope: DocScope;
  accountName: string | null;
  folders: DocFolderData[];
  documents: DocNodeData[];
};

/** A document a task points at. */
export type DocRefData = {
  id: string;
  href: string;
  title: string;
  scope: DocScope;
  accountName: string | null;
  /** Attached deliberately, so it can be detached. */
  attached: boolean;
  /** Named in the description, so it can only be removed by editing the prose. */
  mentioned: boolean;
};

/** A run of a search snippet, and whether it is one of the matched words. */
export type SnippetRunData = { text: string; hit: boolean };

export type DocHitData = {
  id: string;
  href: string;
  title: string;
  scope: DocScope;
  accountName: string | null;
  snippet: SnippetRunData[];
};

/** A task pointing back at a document. */
export type DocBacklinkData = {
  id: string;
  href: string;
  title: string;
  status: StatusRef;
  done: boolean;
  mentionedOnly: boolean;
};
