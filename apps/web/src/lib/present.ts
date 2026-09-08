import "server-only";
import type {
  AttentionItemData,
  BoardData,
  MemberRowData,
  Priority,
  TaskRowData,
  TaskType,
} from "@meridian/ui";
import { dueLabel, now, startOfAppDay } from "@/lib/date";
import type { TaskCard } from "@/queries/sql";
import type { BoardView } from "@/queries/tasks";
import type { MemberRollup } from "@/queries/team";
import type { AttentionItem } from "@/queries/attention";

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
