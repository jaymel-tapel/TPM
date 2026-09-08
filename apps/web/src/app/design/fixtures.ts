import type {
  AttentionItemData,
  MemberRowData,
  AttachmentData,
  BoardData,
  TaskRowData,
  TeamCompareData,
  TrendPointData,
} from "@meridian/ui";

/**
 * Static examples so the gallery renders every state, not just the happy one.
 * Plain data — the design system never touches the database.
 */
const anna = { id: "u-anna", name: "Anna Santos" };
const james = { id: "u-james", name: "James Cruz" };
const sofia = { id: "u-sofia", name: "Sofia Reyes" };

const base = { href: "#", tags: [] as string[], overdue: false, done: false };

export const TASKS: Record<string, TaskRowData> = {
  plain: {
    ...base,
    id: "t1",
    title: "Send client performance report",
    type: "client_work",
    status: { id: "c-todo", name: "To Do", kind: "open" },
    priority: "normal",
    dueText: "Today, 2:00 PM",
    assignees: [anna],
    tags: ["Nike"],
  },
  inProgress: {
    ...base,
    id: "t2",
    title: "Review campaign launch assets",
    type: "review",
    status: { id: "c-doing", name: "In Progress", kind: "open" },
    priority: "normal",
    dueText: "Today, 4:00 PM",
    assignees: [anna, james, sofia],
  },
  highPriority: {
    ...base,
    id: "t3",
    title: "Update ad budget",
    type: "admin",
    status: { id: "c-todo", name: "To Do", kind: "open" },
    priority: "high",
    dueText: "Today, 5:00 PM",
    assignees: [anna],
  },
  blocked: {
    ...base,
    id: "t5",
    title: "QA tracking setup",
    type: "internal",
    status: { id: "c-blocked", name: "Blocked", kind: "blocked" },
    priority: "normal",
    dueText: "Today, 3:00 PM",
    assignees: [anna],
  },
  overdue: {
    ...base,
    id: "t4",
    title: "Reconcile Northline spend",
    type: "client_work",
    status: { id: "c-todo", name: "To Do", kind: "open" },
    priority: "urgent",
    dueText: "Sep 4, 11:00 AM",
    overdue: true,
    assignees: [anna],
    tags: ["Northline"],
  },
  done: {
    ...base,
    id: "t6",
    title: "Weekly meeting notes",
    type: "meeting",
    status: { id: "c-done", name: "Done", kind: "done" },
    priority: "normal",
    dueText: "Today, 10:00 AM",
    done: true,
    assignees: [anna],
  },
};

export const MEMBERS: MemberRowData[] = [
  { id: "m1", href: "#", name: "Sarah Lim", role: "account_director", due: 4, done: 3, overdue: 0, remaining: 1, percent: 75 },
  { id: "m2", href: "#", name: "Anna Santos", role: "team_member", due: 6, done: 5, overdue: 0, remaining: 1, percent: 83 },
  { id: "m3", href: "#", name: "James Cruz", role: "team_member", due: 7, done: 3, overdue: 7, remaining: 4, percent: 43 },
  { id: "m4", href: "#", name: "Sofia Reyes", role: "team_member", due: 6, done: 6, overdue: 0, remaining: 0, percent: 100 },
];

export const ATTENTION: AttentionItemData[] = [
  { severity: "high", headline: "James Cruz", detail: "7 overdue tasks", href: "#" },
  { severity: "medium", headline: "4 tasks due within 2 hours", detail: "Not started yet" },
  { severity: "high", headline: "Team B", detail: "Completion down 12% vs last week", href: "#" },
  { severity: "medium", headline: "3 collaborative tasks", detail: "Still incomplete" },
];

export const TREND: TrendPointData[] = [
  { label: "Mon", percent: 81, due: 148, done: 120 },
  { label: "Tue", percent: 76, due: 152, done: 116 },
  { label: "Wed", percent: 88, due: 139, done: 122 },
  { label: "Thu", percent: 91, due: 144, done: 131 },
  { label: "Fri", percent: 84, due: 151, done: 127 },
  { label: "Sat", percent: 79, due: 62, done: 49 },
  { label: "Sun", percent: 78, due: 157, done: 122 },
];

export const TEAMS: TeamCompareData[] = [
  {
    id: "a",
    href: "#",
    name: "Team A",
    directorName: "Sarah Lim",
    percent: 81,
    overdue: 8,
    delta: 0,
  },
  {
    id: "b",
    href: "#",
    name: "Team B",
    directorName: "Michael Ortega",
    percent: 74,
    overdue: 9,
    delta: -12,
  },
];

export const BOARD: BoardData = {
  columns: [
    { id: "c-todo", name: "To Do", kind: "open", tasks: [TASKS.plain, TASKS.highPriority] },
    { id: "c-doing", name: "In Progress", kind: "open", tasks: [TASKS.inProgress] },
    { id: "c-done", name: "Done", kind: "done", tasks: [TASKS.done] },
    { id: "c-blocked", name: "Blocked", kind: "blocked", tasks: [TASKS.blocked] },
  ],
};

export const ATTACHMENTS: AttachmentData[] = [
  {
    id: "a1",
    filename: "nike-brief-v2.pdf",
    contentType: "application/pdf",
    sizeBytes: 1_240_000,
    uploadedByName: "Anna Santos",
    href: "#",
  },
  {
    id: "a2",
    filename: "hero-crop.png",
    contentType: "image/png",
    sizeBytes: 340_000,
    uploadedByName: "James Cruz",
    href: "#",
  },
  {
    id: "a3",
    filename: "budget-q4.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: 88_000,
    uploadedByName: "Anna Santos",
    href: "#",
  },
];
