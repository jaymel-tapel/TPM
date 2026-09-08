import "server-only";
import { asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { boardStatuses, boards, accounts } from "@/db/schema";
import { listAssignableUsers } from "./accounts";

export type BoardSummary = {
  id: string;
  name: string;
  /** Null on a department board — one that belongs to no account. */
  accountId: string | null;
  accountName: string | null;
};

export type AssignablePerson = { id: string; name: string; account_name: string | null };

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
      accountId: boards.accountId,
      accountName: accounts.name,
    })
    .from(boards)
    // Left, not inner: a department board has no account row to join to, and
    // an inner join would make those boards silently disappear.
    .leftJoin(accounts, eq(accounts.id, boards.accountId))
    .where(eq(boards.id, boardId));
  return row ?? null;
}

/** Every board on an account, for the pickers and the rail. */
export async function listBoardsForAccount(accountId: string): Promise<BoardSummary[]> {
  return db
    .select({
      id: boards.id,
      name: boards.name,
      accountId: boards.accountId,
      accountName: accounts.name,
    })
    .from(boards)
    // Left, not inner: a department board has no account row to join to, and
    // an inner join would make those boards silently disappear.
    .leftJoin(accounts, eq(accounts.id, boards.accountId))
    .where(eq(boards.accountId, accountId))
    .orderBy(asc(boards.position), asc(boards.name));
}

/**
 * Everything a task form needs to file work: the boards this person may write
 * to, and each board's columns. Fetched together because the status list is
 * meaningless without knowing which board it belongs to.
 */
export async function listBoardOptions(user: { role: string; accountIds: string[] }) {
  const rows = await db
    .select({
      id: boards.id,
      name: boards.name,
      accountId: boards.accountId,
      accountName: accounts.name,
    })
    .from(boards)
    // Left, not inner: a department board has no account row to join to, and
    // an inner join would make those boards silently disappear.
    .leftJoin(accounts, eq(accounts.id, boards.accountId))
    .where(
      user.role === "senior_director"
        ? undefined
        : // Every account they work on, and the department's, which are everyone's.
          or(
            user.accountIds.length > 0
              ? inArray(boards.accountId, user.accountIds)
              : sql`false`,
            isNull(boards.accountId),
          ),
    )
    .orderBy(asc(accounts.name), asc(boards.position), asc(boards.name));

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
   * to know that a board's people are really its account's people.
   */
  const accountIds = [...new Set(rows.map((b) => b.accountId))].filter(
    (id): id is string => id !== null,
  );
  // A department board has no account to draw from, so it draws from everyone.
  const anyRootBoard = rows.some((b) => b.accountId === null);
  const people = await listAssignableUsers(anyRootBoard ? undefined : accountIds);

  const peopleByBoard: Record<string, AssignablePerson[]> = {};
  for (const b of rows) {
    peopleByBoard[b.id] = people
      .filter((p) => (b.accountId === null ? true : p.account_ids.includes(b.accountId)))
      // Named by the board's own account where there is one: inside Nike, "Nike"
      // on every row is noise. A department board says who each person is from.
      .map((p) => ({
        id: p.id,
        name: p.name,
        account_name: b.accountId === null ? p.account_names : null,
      }));
  }

  return { boards: rows, statusesByBoard, peopleByBoard };
}
