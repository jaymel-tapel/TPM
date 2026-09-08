import "server-only";
import { asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { boardStatuses, boards, teams } from "@/db/schema";
import { listAssignableUsers } from "./team";

export type BoardSummary = {
  id: string;
  name: string;
  /** Null on a department board — one that belongs to no team. */
  teamId: string | null;
  teamName: string | null;
};

export type AssignablePerson = { id: string; name: string; team_name: string | null };

export type BoardStatus = {
  id: string;
  name: string;
  kind: "open" | "done" | "blocked";
  position: number;
};

/** A board's columns, in the order its owner arranged them. */
export async function listBoardStatuses(boardId: string): Promise<BoardStatus[]> {
  return db
    .select({
      id: boardStatuses.id,
      name: boardStatuses.name,
      kind: boardStatuses.kind,
      position: boardStatuses.position,
    })
    .from(boardStatuses)
    .where(eq(boardStatuses.boardId, boardId))
    .orderBy(asc(boardStatuses.position), asc(boardStatuses.name));
}

export async function getBoard(boardId: string): Promise<BoardSummary | null> {
  const [row] = await db
    .select({
      id: boards.id,
      name: boards.name,
      teamId: boards.teamId,
      teamName: teams.name,
    })
    .from(boards)
    // Left, not inner: a department board has no team row to join to, and
    // an inner join would make those boards silently disappear.
    .leftJoin(teams, eq(teams.id, boards.teamId))
    .where(eq(boards.id, boardId));
  return row ?? null;
}

/** Every board on a team, for the pickers and the rail. */
export async function listBoardsForTeam(teamId: string): Promise<BoardSummary[]> {
  return db
    .select({
      id: boards.id,
      name: boards.name,
      teamId: boards.teamId,
      teamName: teams.name,
    })
    .from(boards)
    // Left, not inner: a department board has no team row to join to, and
    // an inner join would make those boards silently disappear.
    .leftJoin(teams, eq(teams.id, boards.teamId))
    .where(eq(boards.teamId, teamId))
    .orderBy(asc(boards.position), asc(boards.name));
}

/**
 * Everything a task form needs to file work: the boards this person may write
 * to, and each board's columns. Fetched together because the status list is
 * meaningless without knowing which board it belongs to.
 */
export async function listBoardOptions(user: { role: string; teamId: string | null }) {
  const rows = await db
    .select({
      id: boards.id,
      name: boards.name,
      teamId: boards.teamId,
      teamName: teams.name,
    })
    .from(boards)
    // Left, not inner: a department board has no team row to join to, and
    // an inner join would make those boards silently disappear.
    .leftJoin(teams, eq(teams.id, boards.teamId))
    .where(
      user.role === "senior_director"
        ? undefined
        : // Their own team's boards, and the department's, which are everyone's.
          or(eq(boards.teamId, user.teamId ?? ""), isNull(boards.teamId)),
    )
    .orderBy(asc(teams.name), asc(boards.position), asc(boards.name));

  const columns = await db
    .select({
      id: boardStatuses.id,
      boardId: boardStatuses.boardId,
      name: boardStatuses.name,
      kind: boardStatuses.kind,
    })
    .from(boardStatuses)
    .orderBy(asc(boardStatuses.position), asc(boardStatuses.name));

  const statusesByBoard: Record<string, { id: string; name: string; kind: BoardStatus["kind"] }[]> = {};
  for (const b of rows) statusesByBoard[b.id] = [];
  for (const c of columns) {
    statusesByBoard[c.boardId]?.push({ id: c.id, name: c.name, kind: c.kind });
  }

  /*
   * Who can be put on work filed here. Keyed by board for the same reason the
   * columns are: changing the board changes both, and the form should not have
   * to know that a board's people are really its team's people.
   */
  const teamIds = [...new Set(rows.map((b) => b.teamId))].filter(
    (id): id is string => id !== null,
  );
  // A department board has no team to draw from, so it draws from everyone.
  const anyRootBoard = rows.some((b) => b.teamId === null);
  const people = await listAssignableUsers(anyRootBoard ? undefined : teamIds);

  const peopleByBoard: Record<string, AssignablePerson[]> = {};
  for (const b of rows) {
    peopleByBoard[b.id] = people
      .filter((p) => (b.teamId === null ? true : p.team_id === b.teamId))
      .map((p) => ({ id: p.id, name: p.name, team_name: p.team_name }));
  }

  return { boards: rows, statusesByBoard, peopleByBoard };
}
