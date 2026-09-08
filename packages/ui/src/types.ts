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

export type MemberRowData = {
  id: string;
  href: string;
  name: string;
  role: Role;
  due: number;
  done: number;
  overdue: number;
  remaining: number;
  percent: number;
};

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
export type DocScope = "org" | "team";

/** A document in a tree. `children` is what makes it a tree rather than a list. */
export type DocNodeData = {
  id: string;
  href: string;
  title: string;
  scope: DocScope;
  /** The team's name, or null when the document is everyone's. */
  teamName: string | null;
  children: DocNodeData[];
};

/** A document a task points at. */
export type DocRefData = {
  id: string;
  href: string;
  title: string;
  scope: DocScope;
  teamName: string | null;
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
  teamName: string | null;
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
