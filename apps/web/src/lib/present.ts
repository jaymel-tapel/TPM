import "server-only";
import type {
  ActivityItemData,
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
import { agoLabel, dueLabel, now, startOfAppDay } from "@/lib/date";
import { formatDuration } from "@/lib/duration";
import type { TaskCard } from "@/queries/sql";
import type { BoardView } from "@/queries/tasks";
import type { MemberRollup } from "@/queries/team";
import type { AttentionItem } from "@/queries/attention";
import type { ActivityEntry } from "@/queries/activity";
import type { InboxEntry } from "@/queries/notifications";
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
export function toTaskRow(task: TaskCard, reference: Date = now()): TaskRowData {
  const done = task.completedAt !== null;
  return {
    id: task.id,
    href: `/tasks/${task.id}`,
    title: task.title,
    type: task.type as TaskType,
    status: { id: task.statusId, name: task.statusName, kind: task.statusKind },
    priority: task.priority as Priority,
    dueText: dueLabel(task.dueDate, reference),
    // Overdue means carried over from an earlier day, not simply past its
    // clock time today.
    overdue: !done && task.dueDate < startOfAppDay(reference),
    done,
    assignees: task.assignees,
    tags: task.tags,
    docs: task.docs,
  };
}

export function toMemberRow(member: MemberRollup, hrefBase = "/team"): MemberRowData {
  return { ...member, href: `${hrefBase}/${member.id}` };
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
