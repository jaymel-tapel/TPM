import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { IDS, addLeave, day, resetDb, seedOrg, viewerFor } from "../../test/fixture";
import { awayOn, listMyLeave, listPendingFor, listAccountLeave, overlappingLeave } from "./leave";

/** The `Viewer` a page would have been handed — accounts resolved, as in a session. */
const load = viewerFor;

beforeEach(async () => {
  await resetDb();
  await seedOrg();
});

describe("awayOn", () => {
  it("counts only approved leave", async () => {
    // The load-bearing assertion of the whole feature. A pending request is a
    // plan; a roster that showed it would be telling the account somebody is off
    // before the person who decides that has agreed.
    await addLeave({ user: IDS.anna, startDay: 0, status: "pending" });
    await addLeave({ user: IDS.james, startDay: 0, status: "declined" });
    await addLeave({ user: IDS.sarah, startDay: 0, status: "cancelled" });

    expect(await awayOn([IDS.volvo], day(0))).toEqual(new Map());
  });

  it("includes both ends of the range and stops after it", async () => {
    await addLeave({ user: IDS.anna, startDay: 1, endDay: 3 });

    expect((await awayOn([IDS.volvo], day(0))).has(IDS.anna)).toBe(false);
    expect((await awayOn([IDS.volvo], day(1))).has(IDS.anna)).toBe(true);
    expect((await awayOn([IDS.volvo], day(2))).has(IDS.anna)).toBe(true);
    expect((await awayOn([IDS.volvo], day(3))).has(IDS.anna)).toBe(true);
    expect((await awayOn([IDS.volvo], day(4))).has(IDS.anna)).toBe(false);
  });

  it("carries which half of the day, and when they are back", async () => {
    await addLeave({ user: IDS.anna, startDay: 0, half: "pm", kind: "personal" });

    expect((await awayOn([IDS.volvo], day(0))).get(IDS.anna)).toEqual({
      away: "pm",
      kind: "personal",
      endDate: day(0),
    });
  });

  it("does not leak another account", async () => {
    await addLeave({ user: IDS.mika, startDay: 0 });

    expect((await awayOn([IDS.volvo], day(0))).has(IDS.mika)).toBe(false);
    expect((await awayOn([IDS.mg], day(0))).has(IDS.mika)).toBe(true);
  });

  it("reads both accounts in one query", async () => {
    await addLeave({ user: IDS.anna, startDay: 0 });
    await addLeave({ user: IDS.mika, startDay: 0 });

    const away = await awayOn([IDS.volvo, IDS.mg], day(0));
    expect([...away.keys()].sort()).toEqual([IDS.anna, IDS.mika].sort());
  });
});

describe("listPendingFor", () => {
  it("gives an Account Director their own account's members, and nobody else's", async () => {
    await addLeave({ user: IDS.anna, startDay: 1, status: "pending" });
    await addLeave({ user: IDS.mika, startDay: 1, status: "pending" });

    const queue = await listPendingFor(await load(IDS.sarah));
    expect(queue.map((r) => r.userId)).toEqual([IDS.anna]);
  });

  it("gives the Senior Director the directors' requests, which only they can settle", async () => {
    await addLeave({ user: IDS.anna, startDay: 1, status: "pending" });
    await addLeave({ user: IDS.sarah, startDay: 1, status: "pending" });

    const queue = await listPendingFor(await load(IDS.elena));
    // Not Anna's: that one is Sarah's to decide, and a queue row somebody
    // else owns is a row with nothing to do on it.
    expect(queue.map((r) => r.userId)).toEqual([IDS.sarah]);
  });

  it("gives a team member nothing", async () => {
    await addLeave({ user: IDS.james, startDay: 1, status: "pending" });
    expect(await listPendingFor(await load(IDS.anna))).toEqual([]);
  });
});

describe("who may read a note", () => {
  beforeEach(async () => {
    await addLeave({ user: IDS.anna, startDay: 1, note: "Hospital appointment" });
  });

  const noteOn = async (viewerId: string) => {
    const rows = await listAccountLeave(await load(viewerId), IDS.volvo, day(0), day(7));
    return rows[0].note;
  };

  it("gives it to the person who filed it", async () => {
    expect(await noteOn(IDS.anna)).toBe("Hospital appointment");
  });

  it("gives it to the director who decides it", async () => {
    expect(await noteOn(IDS.sarah)).toBe("Hospital appointment");
    expect(await noteOn(IDS.elena)).toBe("Hospital appointment");
  });

  it("withholds it from a teammate", async () => {
    // The dates are the point of the roster. The reason is not: before this
    // feature a team member saw no roster at all, and it should not arrive
    // carrying somebody's medical history.
    expect(await noteOn(IDS.james)).toBeNull();
  });
});

describe("listMyLeave", () => {
  it("returns every status, because you filed it", async () => {
    await addLeave({ user: IDS.anna, startDay: 1, status: "pending" });
    await addLeave({ user: IDS.anna, startDay: 5, status: "declined" });
    await addLeave({ user: IDS.anna, startDay: 9, status: "cancelled" });

    const mine = await listMyLeave(await load(IDS.anna));
    expect(mine.map((r) => r.status).sort()).toEqual(["cancelled", "declined", "pending"]);
  });
});

describe("overlappingLeave", () => {
  it("catches a range that shares a single day", async () => {
    await addLeave({ user: IDS.anna, startDay: 1, endDay: 3 });
    const anna = await load(IDS.anna);

    expect(await overlappingLeave(anna, day(3), day(5))).toHaveLength(1);
    expect(await overlappingLeave(anna, day(-1), day(1))).toHaveLength(1);
    expect(await overlappingLeave(anna, day(4), day(5))).toHaveLength(0);
  });

  it("ignores a request nobody is holding the day with", async () => {
    await addLeave({ user: IDS.anna, startDay: 1, endDay: 3, status: "declined" });
    await addLeave({ user: IDS.anna, startDay: 1, endDay: 3, status: "cancelled" });

    expect(await overlappingLeave(await load(IDS.anna), day(1), day(3))).toHaveLength(0);
  });
});
