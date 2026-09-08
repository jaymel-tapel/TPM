import "server-only";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  documents,
  taskAssignees,
  tasks,
  users,
  type Doc,
  type Role,
  type Task,
  type User,
  boards,
} from "@/db/schema";

export const isDirector = (u: User) => u.role !== "team_member";
export const isSenior = (u: User) => u.role === "senior_director";

/**
 * `icon` is a name, not a component: this module is imported by server code
 * that has no business holding React elements. The sidebar maps it.
 */
export type NavIcon =
  | "today"
  | "myTasks"
  | "boards"
  | "docs"
  | "team"
  | "teams"
  | "reports"
  | "overview";
export type NavChild = { href: string; label: string };
export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /**
   * Filled in by the layout from the org chart, not declared here — this
   * module has no business running a query. A group with no children renders
   * as a plain link, so a role that has nothing to expand shows no chevron.
   */
  children?: NavChild[];
};

/**
 * Navigation is derived from the role rather than hand-maintained, so a link
 * can never appear for someone the permission checks would refuse.
 */
export function navFor(role: Role): NavItem[] {
  switch (role) {
    case "senior_director":
      return [
        { href: "/overview", label: "Overview", icon: "overview" },
        { href: "/teams", label: "Teams", icon: "teams" },
        { href: "/docs", label: "Docs", icon: "docs" },
        { href: "/reports", label: "Reports", icon: "reports" },
      ];
    case "account_director":
      return [
        { href: "/today", label: "Today", icon: "today" },
        { href: "/boards", label: "Boards", icon: "boards" },
        { href: "/team", label: "Team", icon: "team" },
        { href: "/docs", label: "Docs", icon: "docs" },
        { href: "/reports", label: "Reports", icon: "reports" },
      ];
    default:
      return [
        { href: "/today", label: "Today", icon: "today" },
        { href: "/my-tasks", label: "My Tasks", icon: "myTasks" },
        { href: "/boards", label: "Boards", icon: "boards" },
        { href: "/docs", label: "Docs", icon: "docs" },
      ];
  }
}

export function homeFor(role: Role): string {
  return role === "senior_director" ? "/overview" : "/today";
}

export function canViewTeam(viewer: User, teamId: string): boolean {
  if (isSenior(viewer)) return true;
  if (viewer.role === "account_director") return viewer.teamId === teamId;
  return false;
}

/** Refusals read as 404 so one role can't probe for the existence of another's data. */
export async function assertCanViewTeam(viewer: User, teamId: string) {
  if (!canViewTeam(viewer, teamId)) notFound();
}

export async function assertCanViewUser(viewer: User, targetId: string): Promise<User> {
  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  if (!target) notFound();
  if (target.id === viewer.id) return target;
  if (isSenior(viewer)) return target;
  if (
    viewer.role === "account_director" &&
    target.teamId &&
    target.teamId === viewer.teamId
  ) {
    return target;
  }
  notFound();
}

export async function assertCanViewReports(viewer: User) {
  if (!isDirector(viewer)) notFound();
}

/** Assignees and the creator can edit; directors can edit within their scope. */
export async function canEditTask(viewer: User, task: Task): Promise<boolean> {
  if (isSenior(viewer)) return true;
  if (task.createdBy === viewer.id) return true;
  if (viewer.role === "account_director" && viewer.teamId === task.teamId) return true;
  const assignment = await db.query.taskAssignees.findFirst({
    where: and(eq(taskAssignees.taskId, task.id), eq(taskAssignees.userId, viewer.id)),
  });
  return Boolean(assignment);
}

/** Everyone may read a task they can see the team of, or are assigned to. */
export async function canViewTask(viewer: User, task: Task): Promise<boolean> {
  if (isSenior(viewer)) return true;
  if (viewer.teamId === task.teamId) return true;
  return canEditTask(viewer, task);
}

export async function loadEditableTask(viewer: User, taskId: string): Promise<Task> {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) notFound();
  if (!(await canEditTask(viewer, task))) notFound();
  return task;
}

export async function loadViewableTask(viewer: User, taskId: string): Promise<Task> {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) notFound();
  if (!(await canViewTask(viewer, task))) notFound();
  return task;
}

/**
 * Who may shape a team's work: its own Account Director, or the Senior
 * Director. A team member can move a card but not invent the column it moves
 * into — the board is the Account Director's instrument.
 */
export async function assertCanManageTeam(viewer: User, teamId: string) {
  if (isSenior(viewer)) return;
  if (viewer.role === "account_director" && viewer.teamId === teamId) return;
  notFound();
}

export async function assertCanManageBoard(viewer: User, boardId: string) {
  const board = await db.query.boards.findFirst({ where: eq(boards.id, boardId) });
  if (!board) notFound();
  await assertCanManageTeam(viewer, board.teamId);
  return board;
}

/*
 * Documents.
 *
 * Reading follows the org chart the same way everything else does: a document
 * is either the department's or one team's, and you see your own team's plus
 * the department's.
 *
 * Writing is narrower, and deliberately: an org-wide document is a leadership
 * artefact, so only the Senior Director publishes one, and a team's documents
 * belong to whoever already runs that team. That is `canViewTeam`'s rule
 * reused rather than a second rule invented — the person who names a board's
 * columns is the person who writes down how the team works.
 */
/** All a visibility decision needs — so a view type can be asked directly. */
export type DocScopeOf = Pick<Doc, "visibility" | "teamId">;

export function canViewDoc(viewer: User, doc: DocScopeOf): boolean {
  if (isSenior(viewer)) return true;
  if (doc.visibility === "org") return true;
  return Boolean(viewer.teamId) && viewer.teamId === doc.teamId;
}

export function canEditDoc(viewer: User, doc: DocScopeOf): boolean {
  if (isSenior(viewer)) return true;
  if (doc.visibility === "org") return false;
  return viewer.role === "account_director" && viewer.teamId === doc.teamId;
}

/** Whether this person may start a document at all, org-wide or on a team. */
export function canCreateDocs(viewer: User): boolean {
  return isDirector(viewer);
}

/** Only the Senior Director publishes to the whole department. */
export function canCreateOrgDocs(viewer: User): boolean {
  return isSenior(viewer);
}

export async function loadViewableDoc(viewer: User, docId: string): Promise<Doc> {
  const doc = await db.query.documents.findFirst({ where: eq(documents.id, docId) });
  if (!doc) notFound();
  if (!canViewDoc(viewer, doc)) notFound();
  return doc;
}

export async function loadEditableDoc(viewer: User, docId: string): Promise<Doc> {
  const doc = await db.query.documents.findFirst({ where: eq(documents.id, docId) });
  if (!doc) notFound();
  if (!canEditDoc(viewer, doc)) notFound();
  return doc;
}
