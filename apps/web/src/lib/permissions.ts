import "server-only";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskAssignees, tasks, users, type Role, type Task, type User } from "@/db/schema";

export const isDirector = (u: User) => u.role !== "team_member";
export const isSenior = (u: User) => u.role === "senior_director";

/**
 * `icon` is a name, not a component: this module is imported by server code
 * that has no business holding React elements. The sidebar maps it.
 */
export type NavIcon = "today" | "myTasks" | "team" | "teams" | "reports" | "overview";
export type NavItem = { href: string; label: string; icon: NavIcon };

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
        { href: "/reports", label: "Reports", icon: "reports" },
      ];
    case "account_director":
      return [
        { href: "/today", label: "Today", icon: "today" },
        { href: "/team", label: "Team", icon: "team" },
        { href: "/reports", label: "Reports", icon: "reports" },
      ];
    default:
      return [
        { href: "/today", label: "Today", icon: "today" },
        { href: "/my-tasks", label: "My Tasks", icon: "myTasks" },
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
