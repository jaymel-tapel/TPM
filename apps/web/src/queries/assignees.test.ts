import { beforeEach, describe, expect, it } from "vitest";
import { assigneesOutsideAccount, listAssignableUsers } from "./accounts";
import { listBoardOptions } from "./boards";
import { IDS, resetDb, seedOrg } from "../../test/fixture";

/**
 * Work belongs to a board, a board belongs to an account, and a task's assignees
 * are the people responsible for it. Assigning across accounts would put a task
 * in a stranger's My Tasks and count it in their completion rate — so the
 * picker and the guard both key off the board's account, and these hold them to
 * the same answer.
 */
beforeEach(async () => {
  await resetDb();
  await seedOrg();
});

describe("who the picker offers", () => {
  it("offers a board only its own account", async () => {
    const { peopleByBoard } = await listBoardOptions({
      role: "senior_director",
      accountIds: [],
    });

    const volvo = peopleByBoard[IDS.boardA]!.map((p) => p.name).sort();
    const mg = peopleByBoard[IDS.boardB]!.map((p) => p.name).sort();

    expect(volvo).toEqual(["Anna Santos", "James Cruz", "Sarah Lim"]);
    expect(mg).toEqual(["Mika Villanueva"]);
  });

  it("never offers the senior director, who is on no account", async () => {
    const { peopleByBoard } = await listBoardOptions({
      role: "senior_director",
      accountIds: [],
    });
    for (const people of Object.values(peopleByBoard)) {
      expect(people.map((p) => p.name)).not.toContain("Elena Rivera");
    }
  });

  it("shows an account director only their own board's people", async () => {
    // They can file on one board, so there is only one set to offer.
    const { boards, peopleByBoard } = await listBoardOptions({
      role: "account_director",
      accountIds: [IDS.volvo],
    });
    expect(boards.map((b) => b.id)).toEqual([IDS.boardA]);
    expect(peopleByBoard[IDS.boardA]!.map((p) => p.name)).not.toContain("Mika Villanueva");
  });
});

describe("what the server refuses", () => {
  it("names everyone on the list who does not belong", async () => {
    // The old guard checked only `assignees[0]`, so a payload led by a
    // teammate carried the rest in behind it.
    const outside = await assigneesOutsideAccount(IDS.volvo, [
      IDS.anna,
      IDS.mika,
      IDS.elena,
    ]);
    expect(outside.sort()).toEqual(["Elena Rivera", "Mika Villanueva"]);
  });

  it("accepts a list wholly on the account", async () => {
    expect(await assigneesOutsideAccount(IDS.volvo, [IDS.anna, IDS.james, IDS.sarah])).toEqual([]);
  });

  it("refuses the senior director, who is on no board", async () => {
    expect(await assigneesOutsideAccount(IDS.volvo, [IDS.elena])).toEqual(["Elena Rivera"]);
  });

  it("agrees with the picker for every board", async () => {
    const { boards, peopleByBoard } = await listBoardOptions({
      role: "senior_director",
      accountIds: [],
    });
    for (const board of boards) {
      const offered = peopleByBoard[board.id]!.map((p) => p.id);
      expect(
        await assigneesOutsideAccount(board.accountId, offered),
        `"${board.name}" offers people its own guard rejects`,
      ).toEqual([]);
    }
  });
});

describe("who may be named in a mention", () => {
  it("is scoped to the account, not the department", async () => {
    const volvo = await listAssignableUsers([IDS.volvo]);
    expect(volvo.map((p) => p.name)).not.toContain("Mika Villanueva");
  });

  it("falls back to everyone with an account when no account is given", async () => {
    // The org-wide document case: everyone reads it, so anyone can be named.
    const all = await listAssignableUsers();
    expect(all.map((p) => p.name)).toContain("Mika Villanueva");
    expect(all.map((p) => p.name)).not.toContain("Elena Rivera");
  });
});
