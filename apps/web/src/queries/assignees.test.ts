import { beforeEach, describe, expect, it } from "vitest";
import { assigneesOutsideTeam, listAssignableUsers } from "./team";
import { listBoardOptions } from "./boards";
import { IDS, resetDb, seedOrg } from "../../test/fixture";

/**
 * Work belongs to a board, a board belongs to a team, and a task's assignees
 * are the people responsible for it. Assigning across teams would put a task
 * in a stranger's My Tasks and count it in their completion rate — so the
 * picker and the guard both key off the board's team, and these hold them to
 * the same answer.
 */
beforeEach(async () => {
  await resetDb();
  await seedOrg();
});

describe("who the picker offers", () => {
  it("offers a board only its own team", async () => {
    const { peopleByBoard } = await listBoardOptions({
      role: "senior_director",
      teamId: null,
    });

    const teamA = peopleByBoard[IDS.boardA]!.map((p) => p.name).sort();
    const teamB = peopleByBoard[IDS.boardB]!.map((p) => p.name).sort();

    expect(teamA).toEqual(["Anna Santos", "James Cruz", "Sarah Lim"]);
    expect(teamB).toEqual(["Mika Villanueva"]);
  });

  it("never offers the senior director, who is on no team", async () => {
    const { peopleByBoard } = await listBoardOptions({
      role: "senior_director",
      teamId: null,
    });
    for (const people of Object.values(peopleByBoard)) {
      expect(people.map((p) => p.name)).not.toContain("Elena Rivera");
    }
  });

  it("shows an account director only their own board's people", async () => {
    // They can file on one board, so there is only one set to offer.
    const { boards, peopleByBoard } = await listBoardOptions({
      role: "account_director",
      teamId: IDS.teamA,
    });
    expect(boards.map((b) => b.id)).toEqual([IDS.boardA]);
    expect(peopleByBoard[IDS.boardA]!.map((p) => p.name)).not.toContain("Mika Villanueva");
  });
});

describe("what the server refuses", () => {
  it("names everyone on the list who does not belong", async () => {
    // The old guard checked only `assignees[0]`, so a payload led by a
    // teammate carried the rest in behind it.
    const outside = await assigneesOutsideTeam(IDS.teamA, [
      IDS.anna,
      IDS.mika,
      IDS.elena,
    ]);
    expect(outside.sort()).toEqual(["Elena Rivera", "Mika Villanueva"]);
  });

  it("accepts a list wholly on the team", async () => {
    expect(await assigneesOutsideTeam(IDS.teamA, [IDS.anna, IDS.james, IDS.sarah])).toEqual([]);
  });

  it("refuses the senior director, who is on no board", async () => {
    expect(await assigneesOutsideTeam(IDS.teamA, [IDS.elena])).toEqual(["Elena Rivera"]);
  });

  it("agrees with the picker for every board", async () => {
    const { boards, peopleByBoard } = await listBoardOptions({
      role: "senior_director",
      teamId: null,
    });
    for (const board of boards) {
      const offered = peopleByBoard[board.id]!.map((p) => p.id);
      expect(
        await assigneesOutsideTeam(board.teamId, offered),
        `"${board.name}" offers people its own guard rejects`,
      ).toEqual([]);
    }
  });
});

describe("who may be named in a mention", () => {
  it("is scoped to the team, not the department", async () => {
    const teamA = await listAssignableUsers([IDS.teamA]);
    expect(teamA.map((p) => p.name)).not.toContain("Mika Villanueva");
  });

  it("falls back to everyone with a team when no team is given", async () => {
    // The org-wide document case: everyone reads it, so anyone can be named.
    const all = await listAssignableUsers();
    expect(all.map((p) => p.name)).toContain("Mika Villanueva");
    expect(all.map((p) => p.name)).not.toContain("Elena Rivera");
  });
});
