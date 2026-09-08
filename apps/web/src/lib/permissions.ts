import "server-only";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
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
  | "boards"
  | "docs"
  | "team"
  | "teams"
  | "reports"
  | "overview"
  | "admin";
export type NavChild = {
  /** Absent on a row that only groups the rows beneath it. */
  href?: string;
  label: string;
  /**
   * A quieter second line, where a label alone would be ambiguous.
   */
  note?: string;
  /**
   * One more level, and only one. The Senior Director sees every team's
   * boards, and a flat list of them is a list you have to read rather than
   * scan; grouping by team is the org chart the rest of the product already
   * uses. A third level would be the nested spaces the brief refuses.
   */
  children?: NavChild[];
};
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
        // Every team's boards, not one team's. The rail is the quickest way
        // into a client's work, and the person who spans both teams is the one
        // who most often has to cross between them — so it comes before the
        // teams themselves, which are read far less often than they are
        // navigated past.
        { href: "/boards", label: "Boards", icon: "boards" },
        { href: "/teams", label: "Teams", icon: "teams" },
        { href: "/docs", label: "Docs", icon: "docs" },
        { href: "/reports", label: "Reports", icon: "reports" },
        { href: "/admin", label: "Admin", icon: "admin" },
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
        { href: "/boards", label: "Boards", icon: "boards" },
        /*
         * A team member's Team is not the Account Director's Team. The rollup
         * is still management's — `canViewTeam` refuses them and that has not
         * changed. This one answers "who is here this week", which is their
         * own team's business the same way its board is.
         */
        { href: "/team", label: "Team", icon: "team" },
        { href: "/docs", label: "Docs", icon: "docs" },
      ];
  }
}

export function homeFor(role: Role): string {
  return role === "senior_director" ? "/overview" : "/today";
}

/**
 * Whether this person may look at a team the way its director does.
 *
 * Not the numbers — a team's workload is the team's own business and everyone
 * on it reads the same roster, the same way they all read its board and its
 * documents. What this gates is the management *screen*: the completion
 * headline the department is judged on, Needs Attention, the queue of leave
 * decisions only a director makes, and the right to open any one person's day.
 *
 * This is *not* the question "is this your team". A team member belongs to a
 * team without being able to manage it, and asking this one about their own
 * board or their own task refuses them — see `canViewTeamWork`.
 */
export function canViewTeam(viewer: User, teamId: string): boolean {
  if (isSenior(viewer)) return true;
  if (viewer.role === "account_director") return viewer.teamId === teamId;
  return false;
}

/**
 * Whether this person may reach the *work* a team owns — its board, and the
 * tasks filed on it. Everyone on the team can, because it is their own work.
 *
 * Kept apart from `canViewTeam` because the two questions have different
 * answers for a team member, and one predicate answering both is what let the
 * rail offer a board the page then refused. Anything that lists a team's work
 * has to agree with this, or it is advertising a door that does not open.
 */
export function canViewTeamWork(viewer: User, teamId: string | null): boolean {
  if (isSenior(viewer)) return true;
  /*
   * No team means the department's own work — a company retro, a tool trial.
   * There is nothing to scope it by, so everyone sees it. Writing this as
   * `viewer.teamId === teamId` instead would have quietly made it senior-only,
   * because null equals null and nothing else does.
   */
  if (teamId === null) return true;
  return Boolean(viewer.teamId) && viewer.teamId === teamId;
}

export async function assertCanViewTeamWork(viewer: User, teamId: string | null) {
  if (!canViewTeamWork(viewer, teamId)) notFound();
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

/**
 * Who may change the org chart itself.
 *
 * The Senior Director alone, because everything else in the product is derived
 * from it: which board a task can be filed on, who may be assigned, who may be
 * named in a description, what a director can see. An Account Director editing
 * their own team's membership would be editing the thing their own permissions
 * are read from.
 */
export function canAdminister(viewer: User): boolean {
  return isSenior(viewer);
}

export async function assertCanAdminister(viewer: User) {
  if (!canAdminister(viewer)) notFound();
}

export async function assertCanViewReports(viewer: User) {
  if (!isDirector(viewer)) notFound();
}

/** Assignees and the creator can edit; directors can edit within their scope. */
export async function canEditTask(viewer: User, task: Task): Promise<boolean> {
  if (isSenior(viewer)) return true;
  // Department work is everyone's to act on, the same way a team's work is
  // the team's. `Boolean(viewer.teamId)` below is what stops a null on both
  // sides reading as a match by accident.
  if (task.teamId === null) return true;
  if (Boolean(viewer.teamId) && viewer.teamId === task.teamId) return true;
  // Someone assigned work on another team's board can still act on it.
  const assignment = await db.query.taskAssignees.findFirst({
    where: and(eq(taskAssignees.taskId, task.id), eq(taskAssignees.userId, viewer.id)),
  });
  return Boolean(assignment);
}

/*
 * Reading a task and changing one are the same permission.
 *
 * They used to differ: everyone on the team could open a task, but only its
 * author, an assignee or the team's director could touch it — so a teammate
 * looking at work in front of them got a read-only panel and no way to correct
 * a date they could see was wrong. A team's work belongs to the team, which is
 * the rule the team's documents already follow.
 *
 * Deleting is the one thing that is not merely an edit, but it asks first and
 * says who else is on the task, which is the check that matters there.
 */
/** Everyone may read a task they can see the team of, or are assigned to. */
export async function canViewTask(viewer: User, task: Task): Promise<boolean> {
  if (isSenior(viewer)) return true;
  if (task.teamId === null) return true;
  if (Boolean(viewer.teamId) && viewer.teamId === task.teamId) return true;
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
export async function assertCanManageTeam(viewer: User, teamId: string | null) {
  if (isSenior(viewer)) return;
  // A board with no team is the department's, and the department is the
  // Senior Director's to shape.
  if (teamId === null) notFound();
  if (viewer.role === "account_director" && viewer.teamId === teamId) return;
  notFound();
}

/*
 * Leave.
 *
 * Reading takes no new rule. `canViewTeamWork` already answers "may this
 * person reach this team's own business" — true for the Senior Director and
 * for everybody on the team, false for anyone else — which is exactly who may
 * see who is away. Leave reads therefore go through `assertCanViewTeamWork`,
 * and `canViewTeam` keeps refusing team members the management rollup.
 *
 * Deciding is the part that needs its own rule, because it follows the org
 * chart rather than the team.
 */

/**
 * Who decides a leave request: the person above the requester on the chart.
 *
 * A team member's leave is their own Account Director's to approve. An Account
 * Director's is the Senior Director's — a director takes holiday like anyone
 * else, and having nobody to ask is what made this a rule about the chart and
 * not a rule about roles. Nobody decides their own at any level, which is why
 * the self check comes before the seniority one: a Senior Director may decide
 * every request in the department except the one they filed.
 */
export function canDecideLeave(viewer: User, requester: User): boolean {
  if (viewer.id === requester.id) return false;
  if (isSenior(viewer)) return true;
  return (
    viewer.role === "account_director" &&
    requester.role === "team_member" &&
    Boolean(requester.teamId) &&
    requester.teamId === viewer.teamId
  );
}

/** Loads the request and the person who filed it, or refuses as a 404. */
export async function assertCanDecideLeave(
  viewer: User,
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
  if (!canDecideLeave(viewer, requester)) notFound();
  return request;
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
 * Reading follows the org chart the way everything else does: a document is
 * either the department's or one team's, and you see your own team's plus the
 * department's.
 *
 * Writing follows how far up the chart you sit, not who owns the row. Both
 * kinds of director publish to the whole department. A team's documents belong
 * to the team — anyone on it may write them, because the person who does the
 * work is usually the person who knows how it is done, and a runbook only one
 * person may correct is a runbook that goes stale.
 *
 * This is deliberately *not* `canViewTeam`'s rule, which refuses team members
 * outright: that rule is about reading across the org chart, and this one is
 * about writing inside your own team. Reusing it would have quietly locked
 * members out of their own runbooks.
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
  if (doc.visibility === "org") return isDirector(viewer);
  return Boolean(viewer.teamId) && viewer.teamId === doc.teamId;
}

/** Whether this person may start a document at all, org-wide or on a team. */
export function canCreateDocs(viewer: User): boolean {
  return isDirector(viewer) || Boolean(viewer.teamId);
}

/** Directors publish to the whole department. Team members write for theirs. */
export function canCreateOrgDocs(viewer: User): boolean {
  return isDirector(viewer);
}

/**
 * Whether a document may be placed here at all.
 *
 * The one gate every write goes through, so "who may write an org-wide
 * document" is answered in a single place rather than once per action.
 */
export function canPlaceDoc(viewer: User, placement: DocScopeOf): boolean {
  if (placement.visibility === "org") return canCreateOrgDocs(viewer);
  if (!placement.teamId) return false;
  return isSenior(viewer) || viewer.teamId === placement.teamId;
}

export async function assertMayPlaceDoc(viewer: User, placement: DocScopeOf) {
  if (!canPlaceDoc(viewer, placement)) notFound();
}

export async function loadViewableDoc(viewer: User, docId: string): Promise<Doc> {
  const doc = await db.query.documents.findFirst({ where: eq(documents.id, docId) });
  if (!doc) notFound();
  if (!canViewDoc(viewer, doc)) notFound();
  return doc;
}

export async function loadViewableFolder(viewer: User, folderId: string): Promise<Folder> {
  const folder = await db.query.folders.findFirst({ where: eq(folders.id, folderId) });
  if (!folder) notFound();
  if (!canViewDoc(viewer, folder)) notFound();
  return folder;
}

export async function loadEditableFolder(viewer: User, folderId: string): Promise<Folder> {
  const folder = await db.query.folders.findFirst({ where: eq(folders.id, folderId) });
  if (!folder) notFound();
  if (!canEditDoc(viewer, folder)) notFound();
  return folder;
}

export async function loadEditableDoc(viewer: User, docId: string): Promise<Doc> {
  const doc = await db.query.documents.findFirst({ where: eq(documents.id, docId) });
  if (!doc) notFound();
  if (!canEditDoc(viewer, doc)) notFound();
  return doc;
}
