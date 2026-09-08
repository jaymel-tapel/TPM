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
