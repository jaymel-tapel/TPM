/**
 * The presentational contract.
 *
 * This package renders; it never queries. Everything it needs arrives as plain
 * data, so the design system can be developed, reviewed and rendered in the
 * gallery without a database anywhere near it. The app owns the mapping from
 * its Drizzle rows onto these shapes.
 */

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";
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
  status: TaskStatus;
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

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
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
export const TASK_STATUSES = Object.keys(STATUS_LABELS) as TaskStatus[];
export const PRIORITIES = Object.keys(PRIORITY_LABELS) as Priority[];
