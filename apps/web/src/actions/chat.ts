"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatMembers, chatMessages, chatRooms } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { publishToUsers } from "@/lib/realtime";
import { isRoomMember } from "@/queries/chat";

export type ChatState = { error?: string } | null;

/** What a send gives back: the error, or the message that landed. */
export type SendResult = { error: string } | { id: string };

/** Sorted so a pair produces one key whichever of them opens it first. */
const directKeyFor = (a: string, b: string) => [a, b].sort().join(":");

/** Everyone in the room except whoever caused the thing. */
async function otherMembers(roomId: string, actorId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: chatMembers.userId })
    .from(chatMembers)
    .where(eq(chatMembers.roomId, roomId));
  return rows.map((r) => r.userId).filter((id) => id !== actorId);
}

/**
 * Find the conversation between two people, making it if it does not exist.
 *
 * The insert races on purpose: two people messaging each other in the same
 * moment would otherwise each create a room and each reply into the one the
 * other is not reading. `direct_key` is unique, so the second insert loses and
 * re-reads the winner's room.
 */
async function findOrCreateDirect(viewerId: string, otherId: string): Promise<string> {
  const key = directKeyFor(viewerId, otherId);
  const existing = await db.query.chatRooms.findFirst({
    where: eq(chatRooms.directKey, key),
  });
  if (existing) return existing.id;

  const [made] = await db
    .insert(chatRooms)
    .values({ kind: "direct", directKey: key, createdBy: viewerId })
    .onConflictDoNothing()
    .returning({ id: chatRooms.id });

  if (!made) {
    // Somebody else won the race; theirs is the room.
    const won = await db.query.chatRooms.findFirst({
      where: eq(chatRooms.directKey, key),
    });
    if (!won) throw new Error("Could not open that conversation");
    return won.id;
  }

  await db
    .insert(chatMembers)
    .values([
      { roomId: made.id, userId: viewerId },
      { roomId: made.id, userId: otherId },
    ])
    .onConflictDoNothing();
  return made.id;
}

/** Three or more people. Named if somebody named it, by who is in it if not. */
async function createGroup(
  viewerId: string,
  others: string[],
  name: string | null,
): Promise<string> {
  const [room] = await db
    .insert(chatRooms)
    .values({ kind: "channel", name, createdBy: viewerId })
    .returning({ id: chatRooms.id });

  // The person who made it is always in it — a room you made and cannot read
  // would be nobody's.
  await db
    .insert(chatMembers)
    .values([viewerId, ...others].map((userId) => ({ roomId: room!.id, userId })))
    .onConflictDoNothing();
  return room!.id;
}

const startInput = z.object({
  name: z.string().trim().max(60).optional(),
  members: z.array(z.string().uuid()).min(1),
});

/**
 * Start talking to somebody, or to several people.
 *
 * One picker, and the number of people decides what gets made: pick one and you
 * land in the one conversation the two of you have, pick more and it is a
 * group. Asking somebody to choose "a person" or "a channel" before choosing
 * who made them answer a question about our data model.
 */
export async function startConversation(
  _prev: ChatState,
  formData: FormData,
): Promise<ChatState> {
  const parsed = startInput.safeParse({
    name: String(formData.get("name") ?? "").trim() || undefined,
    members: formData.getAll("members").filter(Boolean),
  });
  if (!parsed.success) return { error: "Pick somebody to talk to." };

  const viewer = await requireUser();
  const others = [...new Set(parsed.data.members)].filter((id) => id !== viewer.id);
  if (others.length === 0) return { error: "Pick somebody to talk to." };

  const roomId =
    others.length === 1
      ? await findOrCreateDirect(viewer.id, others[0]!)
      : await createGroup(viewer.id, others, parsed.data.name ?? null);

  revalidatePath("/", "layout");
  redirect(`/chat/${roomId}`);
}

const messageInput = z.object({
  roomId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

/**
 * Say something.
 *
 * The nudge goes out *after* the insert has settled, never inside it: a publish
 * that lands and is then rolled back tells somebody about a message that does
 * not exist. It carries nothing — the recipient's browser re-renders and reads
 * the message from Postgres, past the same permission check as a cold load,
 * which is why chat needed no new Ably channel or capability.
 */
export async function sendMessage(formData: FormData): Promise<SendResult> {
  const parsed = messageInput.safeParse({
    roomId: formData.get("roomId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: "Write something first." };

  const viewer = await requireUser();
  if (!(await isRoomMember(viewer.id, parsed.data.roomId))) notFound();

  /*
   * The id comes back so the thread can show the message immediately and still
   * recognise it when the server list catches up. Without a real id the two
   * copies cannot be told apart, and the message appears twice for as long as
   * the round trip takes.
   */
  const [saved] = await db
    .insert(chatMessages)
    .values({
      roomId: parsed.data.roomId,
      authorId: viewer.id,
      body: parsed.data.body,
    })
    .returning({ id: chatMessages.id });

  // Saying something is reading it. Without this your own message would sit in
  // your own unread count until you looked away and back.
  await db
    .update(chatMembers)
    .set({ lastReadAt: new Date() })
    .where(
      and(eq(chatMembers.roomId, parsed.data.roomId), eq(chatMembers.userId, viewer.id)),
    );

  revalidatePath("/", "layout");
  await publishToUsers(await otherMembers(parsed.data.roomId, viewer.id));
  return { id: saved!.id };
}

export async function markRoomRead(roomId: string) {
  const viewer = await requireUser();
  await db
    .update(chatMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, viewer.id)));
  revalidatePath("/", "layout");
}

/** Its author, and nobody else. A room's history is not a director's to edit. */
export async function deleteMessage(formData: FormData) {
  const id = String(formData.get("messageId") ?? "");
  const viewer = await requireUser();

  await db
    .delete(chatMessages)
    .where(and(eq(chatMessages.id, id), eq(chatMessages.authorId, viewer.id)));

  revalidatePath("/", "layout");
}
