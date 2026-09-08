import { notFound } from "next/navigation";
import { Hash } from "lucide-react";
import { UserAvatar } from "@meridian/ui";
import { requireSession } from "@/lib/auth";
import { getRoom, listMessages } from "@/queries/chat";
import { toChatMessages } from "@/lib/present";
import { ChatConversation } from "@/components/chat-conversation";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { user, zone } = await requireSession();

  // Membership is the whole permission, and a refusal is a 404 so that a room's
  // existence is not something an outsider can probe for.
  const room = await getRoom(user.id, roomId);
  if (!room) notFound();

  const messages = await listMessages(roomId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-gray-300 bg-background-100 px-6 py-3">
        {room.kind === "channel" ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gray-200 text-gray-800">
            <Hash className="size-4" strokeWidth={2} />
          </span>
        ) : (
          <UserAvatar name={room.title} size="md" />
        )}
        <div className="min-w-0">
          <h2 className="truncate text-body-strong text-gray-1000">{room.title}</h2>
          <p className="text-caption text-gray-600">
            {room.kind === "channel"
              ? `${room.members.length} ${room.members.length === 1 ? "person" : "people"}`
              : "Direct message"}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ChatConversation
          roomId={roomId}
          viewerName={user.name}
          zone={zone}
          messages={toChatMessages(messages, user.id, undefined, zone)}
        />
      </div>
    </div>
  );
}
