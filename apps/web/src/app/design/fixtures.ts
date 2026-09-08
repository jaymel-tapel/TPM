import type {
  DocBacklinkData,
  DocFolderData,
  DocHitData,
  DocNodeData,
  DocRefData,
  AttentionItemData,
  MemberRowData,
  LeaveRequestData,
  ActivityItemData,
  InboxItemData,
  PlanBlockData,
  SubtaskData,
  DayChipData,
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

const base = { href: "#", tags: [] as string[], overdue: false, done: false, docs: 0 };

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
    docs: 2,
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
  { id: "m2", href: "#", name: "Anna Santos", role: "team_member", due: 6, done: 6, overdue: 0, remaining: 0, percent: 100 },
  { id: "m3", href: "#", name: "James Cruz", role: "team_member", due: 7, done: 3, overdue: 7, remaining: 4, percent: 43 },
  { id: "m4", href: "#", name: "Paolo Rivera", role: "team_member", due: 0, done: 0, overdue: 0, remaining: 0, percent: 0 },
  {
    id: "m5",
    // Not a link: a team member may open their own day and nobody else's.
    href: null,
    name: "Camille Yap",
    role: "team_member",
    due: 5,
    done: 2,
    overdue: 1,
    remaining: 3,
    percent: 40,
  },
  {
    id: "m6",
    href: "#",
    name: "Sofia Reyes",
    role: "team_member",
    due: 2,
    done: 0,
    overdue: 0,
    remaining: 2,
    percent: 0,
    // The point of the state: 0% is dimmed rather than recomputed, because it
    // is the same number the rollup counted.
    away: { away: "full", kind: "vacation", label: "Away until 18 Sep" },
  },
];

/** The bar on its own, so every proportion can be read side by side. */
export const WORK_BARS: {
  label: string;
  done: number;
  remaining: number;
  overdue: number;
  muted?: boolean;
}[] = [
  { label: "A day in progress", done: 3, remaining: 2, overdue: 1 },
  { label: "Nothing done, half late", done: 0, remaining: 2, overdue: 2 },
  { label: "Finished", done: 6, remaining: 0, overdue: 0 },
  { label: "All carried over", done: 0, remaining: 0, overdue: 4 },
  { label: "All still to do", done: 0, remaining: 5, overdue: 0 },
  { label: "Nothing due", done: 0, remaining: 0, overdue: 0 },
  { label: "Away", done: 0, remaining: 2, overdue: 1, muted: true },
];

export const LEAVE_REQUESTS: LeaveRequestData[] = [
  {
    id: "l1",
    personName: "Anna Santos",
    kind: "vacation",
    status: "pending",
    rangeText: "12–16 Oct",
    lengthText: "5 days",
    note: "Family trip, booked back in June.",
    decisionText: "Waiting on the Account Director",
    cancellable: true,
  },
  {
    id: "l2",
    personName: "James Cruz",
    kind: "personal",
    status: "approved",
    rangeText: "14 Oct",
    lengthText: "Half day (PM)",
    note: null,
    decisionText: "Approved by Sarah Lim",
    cancellable: false,
  },
  {
    id: "l3",
    personName: "Sofia Reyes",
    kind: "unpaid",
    status: "declined",
    rangeText: "28 Dec – 3 Jan",
    lengthText: "5 days",
    note: null,
    decisionText: "Declined by Sarah Lim",
    cancellable: false,
  },
  {
    id: "l4",
    personName: "Marco Ilagan",
    kind: "sick",
    status: "cancelled",
    rangeText: "2 Oct",
    lengthText: "1 day",
    note: null,
    decisionText: null,
    cancellable: false,
  },
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

/* ── documents ────────────────────────────────────────────────────────── */

export const DOC_FOLDERS: DocFolderData[] = [
  {
    id: "f1",
    href: "#",
    name: "How we work",
    scope: "org",
    teamName: null,
    folders: [
      {
        id: "f2",
        href: "#",
        name: "Escalation",
        scope: "org",
        teamName: null,
        folders: [],
        documents: [
          { id: "d3", href: "#", title: "Out of hours", scope: "org", teamName: null },
        ],
      },
    ],
    documents: [
      { id: "d1", href: "#", title: "Start here", scope: "org", teamName: null },
      { id: "d4", href: "#", title: "Brand guidelines", scope: "org", teamName: null },
    ],
  },
  {
    id: "f3",
    href: "#",
    name: "Team A",
    scope: "team",
    teamName: "Team A",
    folders: [],
    documents: [
      { id: "d5", href: "#", title: "Runbook", scope: "team", teamName: "Team A" },
      { id: "d6", href: "#", title: "Reporting checklist", scope: "team", teamName: "Team A" },
    ],
  },
];

/** A document sitting at the top level, in no folder at all. */
export const DOC_LOOSE: DocNodeData[] = [
  { id: "d7", href: "#", title: "Holidays", scope: "org", teamName: null },
];

export const DOC_REFS: DocRefData[] = [
  // Attached deliberately: detachable.
  { id: "d4", href: "#", title: "Brand guidelines", scope: "org", teamName: null, attached: true, mentioned: false },
  // Named in the prose only: no detach button, because the description owns it.
  { id: "d2", href: "#", title: "Escalation", scope: "org", teamName: null, attached: false, mentioned: true },
  // Both — detaching leaves it listed, because the prose still says it.
  { id: "d5", href: "#", title: "Team A runbook", scope: "team", teamName: "Team A", attached: true, mentioned: true },
];

export const DOC_HITS: DocHitData[] = [
  {
    id: "d4",
    href: "#",
    title: "Brand guidelines",
    scope: "org",
    teamName: null,
    snippet: [
      { text: "Blue ", hit: false },
      { text: "#5B88F7", hit: true },
      { text: " carries identity and actions. Yellow ", hit: false },
      { text: "#FFC72C", hit: true },
      { text: " is the single most important number on a screen.", hit: false },
    ],
  },
  {
    id: "d2",
    href: "#",
    title: "Escalation",
    scope: "org",
    teamName: null,
    snippet: [
      { text: "Blocked for more than a day is an ", hit: false },
      { text: "escalation", hit: true },
      { text: ", not a status.", hit: false },
    ],
  },
];

export const DOC_BACKLINKS: DocBacklinkData[] = [
  {
    id: "t1",
    href: "#",
    title: "Send client performance report",
    status: { id: "c-todo", name: "To Do", kind: "open" },
    done: false,
    mentionedOnly: false,
  },
  {
    id: "t6",
    href: "#",
    title: "Weekly meeting notes",
    status: { id: "c-done", name: "Done", kind: "done" },
    done: true,
    mentionedOnly: true,
  },
];

/** A description carrying a mention, so the inline chip is on the gallery. */
export const MENTION_BODY = JSON.stringify([
  {
    type: "paragraph",
    content: [
      { type: "userMention", props: { userId: "u-james", name: "James Cruz" } },
      { type: "text", text: " — if this stalls, follow ", styles: {} },
      { type: "docMention", props: { docId: "d2", title: "Escalation", stale: false } },
      { type: "text", text: " before pinging the client.", styles: {} },
    ],
  },
]);

export const ACTIVITY: ActivityItemData[] = [
  {
    id: "v1",
    kind: "created",
    actorId: "u-sarah",
    actorName: "Sarah Lim",
    body: null,
    spent: null,
    fromLabel: null,
    toLabel: "To Do",
    subjectName: null,
    when: "Sep 4",
    removable: false,
  },
  {
    id: "v2",
    kind: "assigned",
    actorId: "u-sarah",
    actorName: "Sarah Lim",
    body: null,
    spent: null,
    fromLabel: null,
    toLabel: null,
    subjectName: "Anna Santos",
    when: "Sep 4",
    removable: false,
  },
  {
    id: "v3",
    kind: "comment",
    actorId: "u-anna",
    actorName: "Anna Santos",
    body: JSON.stringify([
      {
        type: "paragraph",
        content: [
          { type: "userMention", props: { userId: "u-james", name: "James Cruz" } },
          { type: "text", text: " client pushed the deadline — deck by Thursday.", styles: {} },
        ],
      },
    ]),
    spent: null,
    fromLabel: null,
    toLabel: null,
    subjectName: null,
    when: "2d ago",
    removable: true,
  },
  {
    id: "v4",
    kind: "status_changed",
    actorId: "u-anna",
    actorName: "Anna Santos",
    body: null,
    spent: null,
    // The label is a snapshot: this still reads "In Progress" even after the
    // column was renamed, which is the whole point of storing it as text.
    fromLabel: "To Do",
    toLabel: "In Progress",
    subjectName: null,
    when: "4h ago",
    removable: false,
  },
  {
    id: "v45",
    kind: "time_logged",
    actorId: "u-james",
    actorName: "James Cruz",
    body: null,
    spent: "2h 30m",
    fromLabel: null,
    toLabel: null,
    subjectName: null,
    when: "1h ago",
    removable: true,
  },
  {
    id: "v5",
    kind: "completed",
    actorId: "u-james",
    actorName: "James Cruz",
    body: null,
    spent: null,
    fromLabel: "In Progress",
    toLabel: "Done",
    subjectName: null,
    when: "just now",
    removable: false,
  },
];

export const INBOX: InboxItemData[] = [
  {
    id: "n1",
    kind: "mentioned",
    actorName: "Sarah Lim",
    taskId: "t-1",
    taskTitle: "Nike Q4 campaign brief",
    excerpt: "can you take the deck section? @James Cruz",
    when: "2h ago",
    read: false,
  },
  {
    id: "n2",
    kind: "assigned",
    actorName: "Michael Ortega",
    taskId: "t-2",
    taskTitle: "Send Northline recap",
    excerpt: null,
    when: "4h ago",
    read: false,
  },
  {
    id: "n3",
    kind: "commented",
    actorName: "Anna Santos",
    taskId: "t-3",
    taskTitle: "Weekly meeting notes",
    excerpt: "moved this to Thursday so we have the numbers first",
    when: "1d ago",
    read: true,
  },
];

export const DAY_PLAN: PlanBlockData[] = [
  {
    taskId: "p1",
    href: "/tasks/p1",
    title: "Nike Q4 campaign brief",
    type: "client_work",
    priority: "high",
    done: false,
    startMinutes: 9 * 60,
    minutes: 90,
    timeText: "9:00 AM",
  },
  {
    // Overlapping the brief, so the two share the width the way a calendar does.
    taskId: "p2",
    href: "/tasks/p2",
    title: "Standup",
    type: "meeting",
    priority: "normal",
    done: false,
    startMinutes: 10 * 60,
    minutes: 30,
    timeText: "10:00 AM",
  },
  {
    // Abutting the brief rather than overlapping it: full width, no split.
    taskId: "p3",
    href: "/tasks/p3",
    title: "Send Northline recap",
    type: "admin",
    priority: "normal",
    done: true,
    startMinutes: 11 * 60,
    minutes: 45,
    timeText: "11:00 AM",
  },
];

export const DAY_PLAN_HOURS: Record<number, string> = Object.fromEntries(
  Array.from({ length: 15 }, (_, i) => {
    const hour = 7 + i;
    const suffix = hour < 12 ? "AM" : "PM";
    const twelve = hour % 12 === 0 ? 12 : hour % 12;
    return [hour * 60, `${twelve}:00 ${suffix}`];
  }),
);

export const DAY_CHIPS: DayChipData[] = [
  { href: "#", weekday: "Tue", day: "9", count: 3, active: true, today: true },
  { href: "#", weekday: "Wed", day: "10", count: 1, active: false, today: false },
  { href: "#", weekday: "Thu", day: "11", count: 5, active: false, today: false },
  { href: "#", weekday: "Fri", day: "12", count: 0, active: false, today: false },
  { href: "#", weekday: "Sat", day: "13", count: 0, active: false, today: false },
  { href: "#", weekday: "Sun", day: "14", count: 0, active: false, today: false },
  { href: "#", weekday: "Mon", day: "15", count: 2, active: false, today: false },
];

export const SUBTASKS: SubtaskData[] = [
  {
    id: "s1",
    href: "/tasks/s1",
    title: "Anna — Data",
    done: true,
    dueText: "Today, 11:00 AM",
    overdue: false,
    assignees: [{ id: "u-anna", name: "Anna Santos" }],
  },
  {
    id: "s2",
    href: "/tasks/s2",
    title: "James — Slides",
    done: false,
    dueText: "Today, 4:00 PM",
    overdue: false,
    assignees: [{ id: "u-james", name: "James Cruz" }],
  },
  {
    id: "s3",
    href: "/tasks/s3",
    title: "Sofia — Review",
    done: false,
    dueText: "Yesterday, 5:00 PM",
    overdue: true,
    assignees: [{ id: "u-sofia", name: "Sofia Reyes" }],
  },
];
