import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chatMembers } from "@/db/schema";

export type RoomSummary = {
  id: string;
  kind: "direct" | "channel";
  /** The channel's name, or the other person's on a direct room. */
  title: string;
  /** The last thing said, already flattened to one line. */
  excerpt: string | null;
  lastAt: Date | null;
  unread: number;
};

export type ChatMessageRow = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
};

/** Long enough to recognise, short enough for one line in the room list. */
const EXCERPT = 120;

/**
 * Every room this person is in, busiest first.
 *
 * A direct room, and a group nobody named, has no name of its own — it is named
 * by whoever else is in it, which is why the title is computed here rather than
 * stored. Two people in a room called "Anna Santos" and "Sarah Lim" are looking
 * at the same rows.
 */
export async function listRooms(userId: string): Promise<RoomSummary[]> {
  const result = await db.execute(sql`
    select r.id,
           r.kind,
           coalesce(
             r.name,
             -- Everyone else in it, not just the first of them: a group nobody
             -- named is named by who is in it, and a direct room has exactly
             -- one other person so this is still their name.
             (select string_agg(u.name, ', ' order by u.name)
                from chat_members m2
                join users u on u.id = m2.user_id
              where m2.room_id = r.id and m2.user_id <> ${userId}),
             'Just you'
           ) as title,
           last.body as excerpt,
           last.created_at as last_at,
           (select count(*)::int from chat_messages c
             where c.room_id = r.id
               and c.created_at > me.last_read_at
               and c.author_id <> ${userId}) as unread
    from chat_members me
    join chat_rooms r on r.id = me.room_id
    left join lateral (
      select c.body, c.created_at from chat_messages c
      where c.room_id = r.id order by c.created_at desc, c.id desc limit 1
    ) last on true
    where me.user_id = ${userId}
    -- A room nobody has spoken in yet still belongs at the top: it was just
    -- made, and the person who made it is about to type in it.
    order by coalesce(last.created_at, r.created_at) desc
  `);

  type Row = {
    id: string;
    kind: "direct" | "channel";
    title: string;
    excerpt: string | null;
    last_at: string | null;
    unread: number;
  };

  return (result.rows as unknown as Row[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    excerpt: r.excerpt ? r.excerpt.slice(0, EXCERPT) : null,
    // Strings, not Dates: drizzle swaps node-postgres' timestamp parsers, so a
    // raw execute returns whatever Postgres printed. That crashed the inbox.
    lastAt: r.last_at === null ? null : new Date(r.last_at),
    unread: r.unread,
  }));
}

/**
 * The room, if this person is in it.
 *
 * Membership is the whole permission — there is nothing else to check, and no
 * override. A caller that gets null should 404 rather than render an empty
 * thread, so that a room's existence is not something you can probe for.
 */
export async function getRoom(
  userId: string,
  roomId: string,
): Promise<{ id: string; kind: "direct" | "channel"; title: string; members: string[] } | null> {
  const result = await db.execute(sql`
    select r.id, r.kind,
           coalesce(
             r.name,
             -- Everyone else in it, not just the first of them: a group nobody
             -- named is named by who is in it, and a direct room has exactly
             -- one other person so this is still their name.
             (select string_agg(u.name, ', ' order by u.name)
                from chat_members m2
                join users u on u.id = m2.user_id
              where m2.room_id = r.id and m2.user_id <> ${userId}),
             'Just you'
           ) as title,
           (select coalesce(json_agg(m3.user_id), '[]'::json)
              from chat_members m3 where m3.room_id = r.id) as members
    from chat_rooms r
    join chat_members me on me.room_id = r.id and me.user_id = ${userId}
    where r.id = ${roomId}
  `);

  const row = result.rows[0] as
    | { id: string; kind: "direct" | "channel"; title: string; members: string[] }
    | undefined;
  return row ?? null;
}

/**
 * The scrollback, oldest last.
 *
 * Capped and read newest-first, then flipped: when you cannot show everything,
 * the end of the conversation is the part worth keeping.
 */
export async function listMessages(roomId: string, limit = 100): Promise<ChatMessageRow[]> {
  const result = await db.execute(sql`
    select c.id, c.author_id, u.name as author_name, c.body, c.created_at
    from chat_messages c
    join users u on u.id = c.author_id
    where c.room_id = ${roomId}
    order by c.created_at desc, c.id desc
    limit ${limit}
  `);

  type Row = {
    id: string;
    author_id: string;
    author_name: string;
    body: string;
    created_at: string;
  };

  return (result.rows as unknown as Row[])
    .map((r) => ({
      id: r.id,
      authorId: r.author_id,
      authorName: r.author_name,
      body: r.body,
      createdAt: new Date(r.created_at),
    }))
    .reverse();
}

/** The rail badge: everything unread, across every room. */
export async function getUnreadTotal(userId: string): Promise<number> {
  const result = await db.execute(sql`
    select coalesce(sum(
      (select count(*) from chat_messages c
        where c.room_id = m.room_id
          and c.created_at > m.last_read_at
          and c.author_id <> ${userId})
    ), 0)::int as n
    from chat_members m where m.user_id = ${userId}
  `);
  return (result.rows[0] as { n: number }).n;
}

/** Whether this person is in this room — the one permission chat has. */
export async function isRoomMember(userId: string, roomId: string): Promise<boolean> {
  const row = await db.query.chatMembers.findFirst({
    where: and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, userId)),
  });
  return Boolean(row);
}
