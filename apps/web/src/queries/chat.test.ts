import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chatMembers, chatRooms } from "@/db/schema";
import { listChatPeople } from "./team";
import {
  getRoom,
  getUnreadTotal,
  isRoomMember,
  listMessages,
  listRooms,
} from "./chat";
import { IDS, NOW, addMessage, addRoom, resetDb, seedOrg } from "../../test/fixture";

/**
 * Moves someone's read cursor. Relative to the fixture's frozen clock, not the
 * real one — messages are written at `NOW`, so a cursor set to the wall clock
 * would sit two days after them and nothing would ever read as unread.
 */
const readAt = (roomId: string, userId: string, minutesAgo = 60) =>
  db
    .update(chatMembers)
    .set({ lastReadAt: new Date(NOW.getTime() - minutesAgo * 60_000) })
    .where(sql`room_id = ${roomId} and user_id = ${userId}`);

beforeEach(async () => {
  await resetDb();
  await seedOrg();
});

describe("who can be messaged", () => {
  it("includes the Senior Director", async () => {
    /*
     * The trap. `listAssignableUsers` joins `teams`, and the Senior Director is
     * the one person with no team — so reusing it here would have meant nobody
     * in the department could message their own director, silently and with
     * nothing failing. Pinned so a later tidy-up cannot fold the two together.
     */
    const people = await listChatPeople();
    expect(people.map((p) => p.id)).toContain(IDS.elena);
    expect(people).toHaveLength(5);
  });

  it("says which team somebody is on, and tolerates having none", async () => {
    const people = await listChatPeople();
    expect(people.find((p) => p.id === IDS.anna)!.teamName).toBe("Team A");
    expect(people.find((p) => p.id === IDS.elena)!.teamName).toBeNull();
  });
});

describe("a direct room", () => {
  it("is one room per pair, whichever way round it is made", async () => {
    await addRoom({ kind: "direct", members: [IDS.anna, IDS.james] });

    // The same pair the other way round produces the same key, and the unique
    // index refuses it — which is what stops two people who message each other
    // at once from ending up in separate halves of one conversation.
    await expect(
      addRoom({ kind: "direct", members: [IDS.james, IDS.anna] }),
    ).rejects.toThrow();
  });

  it("is named by whoever else is in it", async () => {
    const room = await addRoom({ kind: "direct", members: [IDS.anna, IDS.james] });
    expect((await getRoom(IDS.anna, room))!.title).toBe("James Cruz");
    expect((await getRoom(IDS.james, room))!.title).toBe("Anna Santos");
  });

  it("does not constrain channels, which may share a name", async () => {
    await addRoom({ kind: "channel", members: [IDS.anna], name: "General" });
    await addRoom({ kind: "channel", members: [IDS.james], name: "General" });
    expect(await db.select().from(chatRooms)).toHaveLength(2);
  });
});

describe("a group nobody named", () => {
  it("is named by everyone else in it, from each reader's side", async () => {
    // Picking two people makes a group rather than a channel, and nobody is
    // asked for a name. So the name is who is in it — minus you, because a
    // conversation is never listed under your own name.
    const room = await addRoom({
      kind: "channel",
      members: [IDS.anna, IDS.james, IDS.elena],
    });

    expect((await getRoom(IDS.anna, room))!.title).toBe("Elena Rivera, James Cruz");
    expect((await getRoom(IDS.elena, room))!.title).toBe("Anna Santos, James Cruz");
  });

  it("keeps the name it was given when it has one", async () => {
    const room = await addRoom({
      kind: "channel",
      members: [IDS.anna, IDS.james, IDS.elena],
      name: "Northline launch",
    });
    expect((await getRoom(IDS.anna, room))!.title).toBe("Northline launch");
  });
});

describe("who may read a room", () => {
  it("is its members and nobody else", async () => {
    const room = await addRoom({ kind: "direct", members: [IDS.anna, IDS.james] });

    expect(await isRoomMember(IDS.anna, room)).toBe(true);
    expect(await isRoomMember(IDS.mika, room)).toBe(false);
    // Not even the Senior Director. A director reading a conversation they are
    // not part of is a different product.
    expect(await isRoomMember(IDS.elena, room)).toBe(false);
  });

  it("returns nothing to an outsider rather than an empty thread", async () => {
    const room = await addRoom({ kind: "direct", members: [IDS.anna, IDS.james] });
    expect(await getRoom(IDS.elena, room)).toBeNull();
    expect(await listRooms(IDS.elena)).toEqual([]);
  });
});

describe("unread", () => {
  let room: string;

  beforeEach(async () => {
    room = await addRoom({ kind: "direct", members: [IDS.anna, IDS.james] });
    await readAt(room, IDS.anna);
    await readAt(room, IDS.james);
  });

  it("counts what somebody else said after you last looked", async () => {
    await addMessage({ roomId: room, authorId: IDS.james, body: "morning" });
    expect(await getUnreadTotal(IDS.anna)).toBe(1);
  });

  it("never counts your own", async () => {
    await addMessage({ roomId: room, authorId: IDS.anna, body: "one" });
    await addMessage({ roomId: room, authorId: IDS.anna, body: "two" });
    expect(await getUnreadTotal(IDS.anna)).toBe(0);
    // James, who has not looked since, sees both.
    expect(await getUnreadTotal(IDS.james)).toBe(2);
  });

  it("clears when you read, and only for you", async () => {
    await addMessage({ roomId: room, authorId: IDS.james, minutesAgo: 10 });
    // Read after it arrived.
    await readAt(room, IDS.anna, 0);

    expect(await getUnreadTotal(IDS.anna)).toBe(0);
    // Anna reading does nothing to James's own count.
    await addMessage({ roomId: room, authorId: IDS.anna, minutesAgo: -1 });
    expect(await getUnreadTotal(IDS.james)).toBe(1);
  });

  it("adds up across rooms for the rail", async () => {
    const other = await addRoom({ kind: "channel", members: [IDS.anna, IDS.mika], name: "Retro" });
    await readAt(other, IDS.anna);

    await addMessage({ roomId: room, authorId: IDS.james });
    await addMessage({ roomId: other, authorId: IDS.mika });
    await addMessage({ roomId: other, authorId: IDS.mika });

    expect(await getUnreadTotal(IDS.anna)).toBe(3);
    expect((await listRooms(IDS.anna)).map((r) => r.unread).sort()).toEqual([1, 2]);
  });

  it("ignores rooms somebody is not in", async () => {
    const theirs = await addRoom({ kind: "direct", members: [IDS.james, IDS.mika] });
    await addMessage({ roomId: theirs, authorId: IDS.james });
    expect(await getUnreadTotal(IDS.anna)).toBe(0);
  });
});

describe("the scrollback", () => {
  it("reads oldest last, and keeps the end when it cannot keep everything", async () => {
    const room = await addRoom({ kind: "direct", members: [IDS.anna, IDS.james] });
    for (let i = 0; i < 5; i += 1) {
      await addMessage({ roomId: room, authorId: IDS.anna, body: `m${i}`, minutesAgo: 50 - i });
    }

    const all = await listMessages(room);
    expect(all.map((m) => m.body)).toEqual(["m0", "m1", "m2", "m3", "m4"]);

    // Capped: the end of a conversation is the part worth keeping.
    const last = await listMessages(room, 2);
    expect(last.map((m) => m.body)).toEqual(["m3", "m4"]);
  });

  it("reads a time as a time, not the string Postgres printed", async () => {
    const room = await addRoom({ kind: "direct", members: [IDS.anna, IDS.james] });
    await addMessage({ roomId: room, authorId: IDS.anna });
    const [message] = await listMessages(room);
    expect(message!.createdAt).toBeInstanceOf(Date);
    expect((await listRooms(IDS.anna))[0]!.lastAt).toBeInstanceOf(Date);
  });

  it("keeps a room that has nothing said in it yet", async () => {
    const room = await addRoom({ kind: "channel", members: [IDS.anna], name: "Quiet" });
    const rooms = await listRooms(IDS.anna);
    expect(rooms.map((r) => r.id)).toContain(room);
    expect(rooms[0]!.excerpt).toBeNull();
  });

  it("goes when the room goes", async () => {
    const room = await addRoom({ kind: "direct", members: [IDS.anna, IDS.james] });
    await addMessage({ roomId: room, authorId: IDS.anna });
    await db.delete(chatRooms).where(eq(chatRooms.id, room));
    expect(await listMessages(room)).toEqual([]);
  });
});
