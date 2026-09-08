import type {
  DocBacklinkData,
  DocFolderData,
  DocHitData,
  DocNodeData,
  DocRefData,
  AttentionItemData,
  MemberRowData,
  ActivityItemData,
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
