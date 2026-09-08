import "server-only";
import type {
  ActivityItemData,
  SubtaskData,
  AvailabilityData,
  LeaveRequestData,
  PlanBlockData,
  InboxItemData,
  AttentionItemData,
  BoardData,
  DocBacklinkData,
  DocFolderData,
  DocHitData,
  DocNodeData,
  DocRefData,
  MemberRowData,
  Priority,
  TaskRowData,
  TaskType,
} from "@meridian/ui";
import { agoLabel, dueLabel, fmtTime, now, startOfAppDay, type Zone } from "@/lib/date";
import { dayKey, leaveDays, lengthText, rangeText, spanDays } from "@/lib/leave";
import type { Role, User } from "@/db/schema";
import { formatDuration } from "@/lib/duration";
import { minutesFromMidnight } from "@/lib/plan";
import type { TaskCard } from "@/queries/sql";
import type { BoardView } from "@/queries/tasks";
import type { MemberRollup } from "@/queries/team";
import type { AwayMark, LeaveRow } from "@/queries/leave";
import type { AttentionItem } from "@/queries/attention";
import type { ActivityEntry } from "@/queries/activity";
import type { InboxEntry } from "@/queries/notifications";
import type { PlanEntry } from "@/queries/schedule";
import type {
  DocBacklink,
  DocRef,
  DocSearchHit,
  DocSummary,
  DocTreeNode,
  FolderSummary,
} from "@/queries/docs";

/**
 * The seam between the database and the design system.
 *
 * `@meridian/ui` renders plain data and knows nothing about Drizzle, the app's
 * routes, or what time it is. Everything that depends on those is resolved
 * here, once, on the server.
 */
export function toTaskRow(
  task: TaskCard,
  reference: Date = now(),
  zone?: Zone,
): TaskRowData {
  const done = task.completedAt !== null;
  return {
    id: task.id,
    href: `/tasks/${task.id}`,
    title: task.title,
    type: task.type as TaskType,
    status: { id: task.statusId, name: task.statusName, kind: task.statusKind },
    priority: task.priority as Priority,
    dueText: dueLabel(task.dueDate, reference, zone),
    // Overdue means carried over from an earlier day, not simply past its
    // clock time today.
    overdue: !done && task.dueDate < startOfAppDay(reference, zone),
    done,
    assignees: task.assignees,
    tags: task.tags,
    docs: task.docs,
  };
}

/* ── Leave and availability ─────────────────────────────────────────────── */

const HALF_LABEL = { am: "Away this morning", pm: "Away this afternoon" } as const;

/**
 * The away marker, with its sentence already written.
 *
 * `@meridian/ui` has no calendar, so "Away until Fri 18 Sep" is composed here
 * — the same seam `dueLabel` draws for a task. The run's end is only mentioned
 * when it is still ahead: on the last day of somebody's leave, "away until
 * today" is a worse sentence than "away today".
 */
export function toAvailability(
  away: AwayMark | null,
  reference: Date = now(),
  zone?: Zone,
): AvailabilityData | null {
  if (!away) return null;
  if (away.away !== "full") {
    return { away: away.away, kind: away.kind, label: HALF_LABEL[away.away] };
  }

  const today = dayKey(reference, zone);
  const label =
    away.endDate > today
      ? `Away until ${rangeText(away.endDate, away.endDate)}`
      : "Away today";
  return { away: "full", kind: away.kind, label };
}

/**
 * A request as a row reads it.
 *
 * `cancellable` and the decision sentence are resolved here because both are
 * questions about who is looking and what day it is, and the design system
 * knows neither.
 */
export function toLeaveRequest(
  row: LeaveRow,
  viewer: User,
  reference: Date = now(),
  zone?: Zone,
): LeaveRequestData {
  const today = dayKey(reference, zone);

  const decisionText =
    row.status === "pending"
      ? row.role === "account_director"
        ? "Waiting on the Senior Director"
        : "Waiting on the Account Director"
      : row.decidedByName
        ? `${LEAVE_DECISION_VERB[row.status]} by ${row.decidedByName}`
        : row.status === "approved"
          ? "Recorded"
          : null;

  return {
    id: row.id,
    personName: row.userName,
    kind: row.kind,
    status: row.status,
    rangeText: rangeText(row.startDate, row.endDate),
    lengthText: lengthText(
      leaveDays(row.startDate, row.endDate, row.half),
      row.half,
      spanDays(row.startDate, row.endDate),
    ),
    note: row.note,
    decisionText,
    // Yours to withdraw, while there is still something to withdraw. Leave
    // already taken stays on the record.
    cancellable:
      row.userId === viewer.id &&
      (row.status === "pending" || row.status === "approved") &&
      row.endDate >= today,
  };
}

const LEAVE_DECISION_VERB = {
  approved: "Approved",
  declined: "Declined",
  cancelled: "Cancelled",
  pending: "",
} as const;

export function toMemberRow(
  member: MemberRollup,
  /**
   * Where the row goes, or null for a reader who may not open this person.
   * A string is a base path the person's id is appended to; null is "not a
   * link", which is most of a team member's own roster.
   */
  href: string | null = "/team",
  reference: Date = now(),
  zone?: Zone,
): MemberRowData {
  return {
    ...member,
    href: href === null ? null : `${href}/${member.id}`,
    away: toAvailability(member.away, reference, zone),
  };
}

export function toAttentionItem(item: AttentionItem): AttentionItemData {
  return item;
}

/** A board's columns become columns of TaskRowData, one adapter per task. */
export function toBoard(board: BoardView, reference: Date = now()): BoardData {
  return {
    columns: board.columns.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      tasks: c.tasks.map((t) => toTaskRow(t, reference)),
    })),
  };
}

/*
 * Documents. `visibility` is the column's word and `scope` is the reader's —
 * the design system is told whose a document is, not how the row spells it.
 */
const scopeOf = (doc: { visibility: "org" | "team"; teamName: string | null }) => ({
  scope: doc.visibility,
  teamName: doc.teamName,
});

export function toDocNode(doc: DocSummary): DocNodeData {
  return { id: doc.id, href: doc.href, title: doc.title, ...scopeOf(doc) };
}

export function toDocFolder(folder: DocTreeNode): DocFolderData {
  return {
    id: folder.id,
    href: folder.href,
    name: folder.name,
    ...scopeOf(folder),
    folders: folder.folders.map(toDocFolder),
    documents: folder.documents.map(toDocNode),
  };
}

/** A folder with nothing read into it yet — a row in a listing. */
export function toDocFolderRow(folder: FolderSummary): DocFolderData {
  return {
    id: folder.id,
    href: folder.href,
    name: folder.name,
    ...scopeOf(folder),
    folders: [],
    documents: [],
  };
}

export function toDocRef(doc: DocRef & { teamName?: string | null }): DocRefData {
  return {
    id: doc.id,
    href: doc.href,
    title: doc.title,
    scope: doc.visibility,
    teamName: doc.teamName ?? null,
    attached: doc.attached,
    mentioned: doc.mentioned,
  };
}

export function toDocHit(hit: DocSearchHit): DocHitData {
  return {
    id: hit.id,
    href: hit.href,
    title: hit.title,
    ...scopeOf(hit),
    snippet: hit.snippet,
  };
}

export function toDocBacklink(link: DocBacklink): DocBacklinkData {
  return {
    id: link.id,
    href: link.href,
    title: link.title,
    status: { id: link.id, name: link.statusName, kind: link.statusKind },
    done: link.done,
    mentionedOnly: link.mentionedOnly,
  };
}



/**
 * One activity row, ready to render. `removable` is decided here rather than in
 * the component: whether a viewer may delete a comment is a permission, and the
 * design system does not get to hold opinions about those.
 */
export function toActivityItem(
  entry: ActivityEntry,
  viewer: { id: string; role: string },
  reference: Date = now(),
): ActivityItemData {
  return {
    id: entry.id,
    kind: entry.kind,
    actorId: entry.actorId,
    actorName: entry.actorName,
    body: entry.body,
    // Formatted here: the design system has no opinion on what a day is worth.
    spent: entry.minutes === null ? null : formatDuration(entry.minutes),
    fromLabel: entry.fromLabel,
    toLabel: entry.toLabel,
    subjectName: entry.subjectName,
    when: agoLabel(entry.createdAt, reference),
    removable:
      (entry.kind === "comment" || entry.kind === "time_logged") &&
      (entry.actorId === viewer.id || viewer.role !== "team_member"),
  };
}

/**
 * One inbox row, ready to render. The excerpt was already flattened in the
 * query — the design system never receives a document to mount an editor for.
 */
export function toInboxItem(entry: InboxEntry, reference: Date = now()): InboxItemData {
  return {
    id: entry.id,
    kind: entry.kind,
    actorName: entry.actorName,
    taskId: entry.taskId,
    taskTitle: entry.taskTitle,
    excerpt: entry.excerpt,
    when: agoLabel(entry.createdAt, reference),
    read: entry.readAt !== null,
  };
}

/**
 * One block on the day plan.
 *
 * The raw `Date` stops here: `@meridian/ui` has no clock and no timezone, so it
 * gets minutes from the app day's own midnight plus a formatted label. Same
 * seam `toTaskRow` draws with `dueText`.
 */
export function toPlanBlock(entry: PlanEntry, zone?: Zone): PlanBlockData {
  return {
    taskId: entry.taskId,
    href: `/tasks/${entry.taskId}`,
    title: entry.title,
    type: entry.type as TaskType,
    priority: entry.priority as Priority,
    done: entry.done,
    startMinutes: minutesFromMidnight(entry.startsAt, zone),
    minutes: entry.minutes,
    timeText: fmtTime(entry.startsAt, zone),
  };
}

/** One piece of a broken-down task, ready to render. */
export function toSubtask(task: TaskCard, reference: Date = now(), zone?: Zone): SubtaskData {
  const done = task.completedAt !== null;
  return {
    id: task.id,
    href: `/tasks/${task.id}`,
    title: task.title,
    done,
    dueText: dueLabel(task.dueDate, reference, zone),
    overdue: !done && task.dueDate < startOfAppDay(reference, zone),
    assignees: task.assignees,
  };
}
