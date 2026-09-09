import "server-only";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import type { Viewer } from "@/lib/auth";
import {
  accountMembers,
  documents,
  folders,
  leaveRequests,
  taskAssignees,
  tasks,
  users,
  type Doc,
  type Folder,
  type LeaveRequest,
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
  | "mytasks"
  | "docs"
  | "accounts"
  | "people"
  | "reports"
  | "overview"
  | "admin"
  | "chat";

export type NavChild = {
  href: string;
  label: string;
};

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /**
   * Starts a new group above this item — a little air, no heading. People and
   * Reports are about the work; Chat and Docs are somewhere else you go.
   */
  gap?: boolean;
  /**
   * An unread badge. Filled in by the layout, like the accounts — this module
   * runs no queries. Chat is the only item that carries one; everything else
   * in the rail is a place rather than a queue.
   */
  count?: number;
};

/**
 * One account, and the four pages inside it.
 *
 * Kept apart from `NavItem` because an account is not a global destination
 * that happens to have children: it is a container, it draws differently, and
 * only one of them is open at a time. Modelling it as a nav item with children
 * is what produced a rail with an Accounts list *and* a Boards list, each
 * repeating every client's name.
 */
export type NavAccount = {
  id: string;
  name: string;
  href: string;
  children: NavChild[];
};

/** The four pages every account has. More than four is a workspace. */
export function accountNav(accountId: string): NavChild[] {
  const base = `/accounts/${accountId}`;
  return [
    { href: base, label: "Overview" },
    { href: `${base}/tasks`, label: "Tasks" },
    { href: `${base}/campaigns`, label: "Campaigns" },
    { href: `${base}/team`, label: "Team" },
  ];
}

/**
 * Navigation is derived from the role rather than hand-maintained, so a link
 * can never appear for someone the permission checks would refuse.
 *
 * Two levels of navigation, and the split is the whole point. The items here
 * work across every account the reader can reach; the accounts themselves are
 * added by the layout, and everything inside one is about that client alone.
 *
 * There is deliberately no Boards item. A board is the set of columns an
 * account's Tasks page is drawn with, not a place — listing boards beside
 * accounts gave the rail two hierarchies for one thing, each repeating the
 * same client names.
 */
export function navFor(role: Role): { before: NavItem[]; after: NavItem[] } {
  const overview: NavItem = { href: "/overview", label: "Overview", icon: "overview" };
  const today: NavItem = { href: "/today", label: "Today", icon: "today" };
  const mine: NavItem = { href: "/my-tasks", label: "My Tasks", icon: "mytasks" };

  const after: NavItem[] = [
    { href: "/people", label: "People", icon: "people" },
    ...(role === "team_member"
      ? []
      : [{ href: "/reports", label: "Reports", icon: "reports" as const }]),
    { href: "/chat", label: "Chat", icon: "chat", gap: true },
    { href: "/docs", label: "Docs", icon: "docs" },
    ...(role === "senior_director"
      ? [{ href: "/admin", label: "Admin", icon: "admin" as const }]
      : []),
  ];

  /*
   * The Senior Director has no day of their own — no work is assigned to them
   * — so Today and My Tasks would open on an empty page every morning.
   */
  const before = role === "senior_director" ? [overview] : [overview, today, mine];
  return { before, after };
}

export function homeFor(role: Role): string {
  return role === "senior_director" ? "/overview" : "/today";
}

/**
 * Whether this person may look at an account the way its director does.
 *
 * Not the numbers — an account's workload is the account's own business and everyone
 * on it reads the same roster, the same way they all read its board and its
 * documents. What this gates is the management *screen*: the completion
 * headline the department is judged on, Needs Attention, the queue of leave
 * decisions only a director makes, and the right to open any one person's day.
 *
 * This is *not* the question "is this your account". A team member belongs to a
 * account without being able to manage it, and asking this one about their own
 * board or their own task refuses them — see `canViewAccountWork`.
 */
export function canViewAccount(viewer: Viewer, accountId: string): boolean {
  if (isSenior(viewer)) return true;
  return viewer.directedIds.includes(accountId);
}

/**
 * Whether this person may reach the *work* an account owns — its board, and the
 * tasks filed on it. Everyone on the account can, because it is their own work.
 *
 * Kept apart from `canViewAccount` because the two questions have different
 * answers for a team member, and one predicate answering both is what let the
 * rail offer a board the page then refused. Anything that lists an account's work
 * has to agree with this, or it is advertising a door that does not open.
 */
export function canViewAccountWork(viewer: Viewer, accountId: string | null): boolean {
  if (isSenior(viewer)) return true;
  /*
   * No account means the department's own work — a company retro, a tool
   * trial. There is nothing to scope it by, so everyone sees it. This has to
   * be answered before the membership test rather than after: `accountIds`
   * holds no nulls, so a null would fall through to `includes(null)` and read
   * as a refusal instead of as "everybody's".
   */
  if (accountId === null) return true;
  return viewer.accountIds.includes(accountId);
}

export async function assertCanViewAccountWork(viewer: Viewer, accountId: string | null) {
  if (!canViewAccountWork(viewer, accountId)) notFound();
}

/** Refusals read as 404 so one role can't probe for the existence of another's data. */
export async function assertCanViewAccount(viewer: Viewer, accountId: string) {
  if (!canViewAccount(viewer, accountId)) notFound();
}

/**
 * Whose day may be opened: your own, anybody's if you are the Senior Director,
 * and — for an Account Director — anybody working on an account they direct.
 *
 * This is the one permission that cannot be answered from the session alone.
 * The accounts that matter here are the *target's*, and membership is a table
 * now rather than a column, so it costs a query. It is asked once per person
 * page, which is where that belongs.
 */
export async function assertCanViewUser(viewer: Viewer, targetId: string): Promise<User> {
  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  if (!target) notFound();
  if (target.id === viewer.id) return target;
  if (isSenior(viewer)) return target;
  if (viewer.role === "account_director" && viewer.directedIds.length > 0) {
    const shared = await db.query.accountMembers.findFirst({
      where: and(
        eq(accountMembers.userId, target.id),
        inArray(accountMembers.accountId, viewer.directedIds),
      ),
    });
    if (shared) return target;
  }
  notFound();
}

/**
 * Who may change the org chart itself.
 *
 * The Senior Director alone, because everything else in the product is derived
 * from it: which board a task can be filed on, who may be assigned, who may be
 * named in a description, what a director can see. An Account Director editing
 * their own account's membership would be editing the thing their own permissions
 * are read from.
 */
export function canAdminister(viewer: Viewer): boolean {
  return isSenior(viewer);
}

export async function assertCanAdminister(viewer: Viewer) {
  if (!canAdminister(viewer)) notFound();
}

export async function assertCanViewReports(viewer: Viewer) {
  if (!isDirector(viewer)) notFound();
}

/** Assignees and the creator can edit; directors can edit within their scope. */
export async function canEditTask(viewer: Viewer, task: Task): Promise<boolean> {
  if (isSenior(viewer)) return true;
  // Department work is everyone's to act on, the same way an account's work is
  // the account's. Answered before the membership test, because a null account
  // is "everybody's" rather than "nobody's".
  if (task.accountId === null) return true;
  if (viewer.accountIds.includes(task.accountId)) return true;
  // Someone assigned work on another account's board can still act on it.
  const assignment = await db.query.taskAssignees.findFirst({
    where: and(eq(taskAssignees.taskId, task.id), eq(taskAssignees.userId, viewer.id)),
  });
  return Boolean(assignment);
}

/*
 * Reading a task and changing one are the same permission.
 *
 * They used to differ: everyone on the account could open a task, but only its
 * author, an assignee or the account's director could touch it — so a teammate
 * looking at work in front of them got a read-only panel and no way to correct
 * a date they could see was wrong. An account's work belongs to the account, which is
 * the rule the account's documents already follow.
 *
 * Deleting is the one thing that is not merely an edit, but it asks first and
 * says who else is on the task, which is the check that matters there.
 */
/** Everyone may read a task they can see the account of, or are assigned to. */
export async function canViewTask(viewer: Viewer, task: Task): Promise<boolean> {
  if (isSenior(viewer)) return true;
  if (task.accountId === null) return true;
  if (viewer.accountIds.includes(task.accountId)) return true;
  return canEditTask(viewer, task);
}

export async function loadEditableTask(viewer: Viewer, taskId: string): Promise<Task> {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) notFound();
  if (!(await canEditTask(viewer, task))) notFound();
  return task;
}

export async function loadViewableTask(viewer: Viewer, taskId: string): Promise<Task> {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) notFound();
  if (!(await canViewTask(viewer, task))) notFound();
  return task;
}

/**
 * Who may shape an account's work: its own Account Director, or the Senior
 * Director. A team member can move a card but not invent the column it moves
 * into — the board is the Account Director's instrument.
 */
export async function assertCanManageAccount(viewer: Viewer, accountId: string | null) {
  if (isSenior(viewer)) return;
  // A board with no account is the department's, and the department is the
  // Senior Director's to shape.
  if (accountId === null) notFound();
  // Directing it, not merely working on it. Being on Volvo lets you move a card;
  // it does not let you invent the column it moves into.
  if (viewer.role === "account_director" && viewer.directedIds.includes(accountId)) return;
  notFound();
}

/*
 * Leave.
 *
 * Reading takes no new rule. `canViewAccountWork` already answers "may this
 * person reach this account's own business" — true for the Senior Director and
 * for everybody on the account, false for anyone else — which is exactly who may
 * see who is away. Leave reads therefore go through `assertCanViewAccountWork`,
 * and `canViewAccount` keeps refusing team members the management rollup.
 *
 * Deciding is the part that needs its own rule, because it follows the org
 * chart rather than the account.
 */

/**
 * Who decides a leave request: somebody above the requester on the chart.
 *
 * "Their own Account Director" used to name exactly one person, because a
 * person sat on exactly one team. Now that they work on several accounts the
 * chart has more than one edge into them, and the honest rule is that **any
 * director of an account they work on** may sign it off — whoever gets there
 * first settles it. Anna is on Volvo and MG; if Sarah directs both, nothing
 * changed for her, and if two directors split them, either can answer.
 *
 * Two things carry over unchanged. An Account Director's own leave is still
 * the Senior Director's, because a director asking a peer would be asking
 * sideways rather than up. And nobody decides their own at any level, which is
 * why the self check comes before the seniority one: a Senior Director may
 * decide every request in the department except the one they filed.
 *
 * The requester's accounts are passed in rather than read here, because they
 * are a fact about somebody who is not the viewer — the caller has already
 * joined them, and a predicate that quietly ran a query could not be tested
 * against a table of cases.
 */
export function canDecideLeave(
  viewer: Viewer,
  requester: User,
  requesterAccountIds: string[],
): boolean {
  if (viewer.id === requester.id) return false;
  if (isSenior(viewer)) return true;
  if (viewer.role !== "account_director") return false;
  if (requester.role !== "team_member") return false;
  return requesterAccountIds.some((id) => viewer.directedIds.includes(id));
}

/** Loads the request and the person who filed it, or refuses as a 404. */
export async function assertCanDecideLeave(
  viewer: Viewer,
  requestId: string,
): Promise<LeaveRequest> {
  const request = await db.query.leaveRequests.findFirst({
    where: eq(leaveRequests.id, requestId),
  });
  if (!request) notFound();
  const requester = await db.query.users.findFirst({
    where: eq(users.id, request.userId),
  });
  if (!requester) notFound();
  const memberships = await db
    .select({ accountId: accountMembers.accountId })
    .from(accountMembers)
    .where(eq(accountMembers.userId, requester.id));
  if (!canDecideLeave(viewer, requester, memberships.map((row) => row.accountId))) {
    notFound();
  }
  return request;
}

export async function assertCanManageBoard(viewer: Viewer, boardId: string) {
  const board = await db.query.boards.findFirst({ where: eq(boards.id, boardId) });
  if (!board) notFound();
  await assertCanManageAccount(viewer, board.accountId);
  return board;
}

/*
 * Documents.
 *
 * Reading follows the org chart the way everything else does: a document is
 * either the department's or one account's, and you see your own account's plus the
 * department's.
 *
 * Writing follows how far up the chart you sit, not who owns the row. Both
 * kinds of director publish to the whole department. An account's documents belong
 * to the account — anyone on it may write them, because the person who does the
 * work is usually the person who knows how it is done, and a runbook only one
 * person may correct is a runbook that goes stale.
 *
 * This is deliberately *not* `canViewAccount`'s rule, which refuses team members
 * outright: that rule is about reading across the org chart, and this one is
 * about writing inside your own account. Reusing it would have quietly locked
 * members out of their own runbooks.
 */
/** All a visibility decision needs — so a view type can be asked directly. */
export type DocScopeOf = Pick<Doc, "visibility" | "accountId">;

export function canViewDoc(viewer: Viewer, doc: DocScopeOf): boolean {
  if (isSenior(viewer)) return true;
  if (doc.visibility === "org") return true;
  return doc.accountId !== null && viewer.accountIds.includes(doc.accountId);
}

export function canEditDoc(viewer: Viewer, doc: DocScopeOf): boolean {
  if (isSenior(viewer)) return true;
  if (doc.visibility === "org") return isDirector(viewer);
  return doc.accountId !== null && viewer.accountIds.includes(doc.accountId);
}

/** Whether this person may start a document at all, org-wide or on an account. */
export function canCreateDocs(viewer: Viewer): boolean {
  return isDirector(viewer) || viewer.accountIds.length > 0;
}

/** Directors publish to the whole department. Team members write for theirs. */
export function canCreateOrgDocs(viewer: Viewer): boolean {
  return isDirector(viewer);
}

/**
 * Whether a document may be placed here at all.
 *
 * The one gate every write goes through, so "who may write an org-wide
 * document" is answered in a single place rather than once per action.
 */
export function canPlaceDoc(viewer: Viewer, placement: DocScopeOf): boolean {
  if (placement.visibility === "org") return canCreateOrgDocs(viewer);
  if (!placement.accountId) return false;
  return isSenior(viewer) || viewer.accountIds.includes(placement.accountId);
}

export async function assertMayPlaceDoc(viewer: Viewer, placement: DocScopeOf) {
  if (!canPlaceDoc(viewer, placement)) notFound();
}

export async function loadViewableDoc(viewer: Viewer, docId: string): Promise<Doc> {
  const doc = await db.query.documents.findFirst({ where: eq(documents.id, docId) });
  if (!doc) notFound();
  if (!canViewDoc(viewer, doc)) notFound();
  return doc;
}

export async function loadViewableFolder(viewer: Viewer, folderId: string): Promise<Folder> {
  const folder = await db.query.folders.findFirst({ where: eq(folders.id, folderId) });
  if (!folder) notFound();
  if (!canViewDoc(viewer, folder)) notFound();
  return folder;
}

export async function loadEditableFolder(viewer: Viewer, folderId: string): Promise<Folder> {
  const folder = await db.query.folders.findFirst({ where: eq(folders.id, folderId) });
  if (!folder) notFound();
  if (!canEditDoc(viewer, folder)) notFound();
  return folder;
}

export async function loadEditableDoc(viewer: Viewer, docId: string): Promise<Doc> {
  const doc = await db.query.documents.findFirst({ where: eq(documents.id, docId) });
  if (!doc) notFound();
  if (!canEditDoc(viewer, doc)) notFound();
  return doc;
}
