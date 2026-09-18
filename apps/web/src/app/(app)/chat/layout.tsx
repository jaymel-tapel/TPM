import { Plus } from "lucide-react";
import { ButtonLink } from "@tpm/ui";
import { requireSession } from "@/lib/auth";
import { listRooms } from "@/queries/chat";
import { toRoomListItem } from "@/lib/present";
import { ChatRoomList } from "@/components/chat-room-list";

export const dynamic = "force-dynamic";

/**
 * The chat shell: conversations on the left, whatever is open on the right.
 *
 * It takes the whole screen rather than sitting in the page's padded column.
 * A conversation is a place you stay in, not a document you scroll — the list
 * has to stay put while you move between rooms, and the composer has to sit at
 * the bottom of the window rather than at the bottom of the page.
 *
 * The negative margins cancel the app frame's padding; the height leaves a
 * gutter at the foot of the window so the composer never ends up underneath
 * the floating role switcher.
 */
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const { user, zone } = await requireSession();
  const rooms = await listRooms(user.id);

  return (
    <div className="-mx-8 -my-8 flex h-[calc(100vh-4rem)] min-h-0 overflow-hidden bg-background-100">
      <aside className="flex w-full max-w-80 shrink-0 flex-col border-r border-gray-300">
        <header className="flex shrink-0 items-center justify-between gap-3 px-5 py-4">
          <h1 className="text-title-3 text-gray-1000">Chat</h1>
          <ButtonLink href="/chat/new" size="sm">
            <Plus className="size-4" strokeWidth={2} />
            New
          </ButtonLink>
        </header>

        <ChatRoomList
          rooms={rooms.map((room) => {
            const { active: _active, ...rest } = toRoomListItem(room, null, undefined, zone);
            return rest;
          })}
        />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-background-200">{children}</section>
    </div>
  );
}
