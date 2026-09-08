import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { boardStatuses, boards, teams } from "@/db/schema";

export type BoardSummary = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
};

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
    .innerJoin(teams, eq(teams.id, boards.teamId))
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
    .innerJoin(teams, eq(teams.id, boards.teamId))
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
    .innerJoin(teams, eq(teams.id, boards.teamId))
    .where(user.role === "senior_director" ? undefined : eq(boards.teamId, user.teamId ?? ""))
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

  return { boards: rows, statusesByBoard };
}
