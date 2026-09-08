"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { RoomList, type RoomListItemData } from "@meridian/ui";

type Room = Omit<RoomListItemData, "active">;

/**
 * The conversations column.
 *
 * It lives in the chat layout so it survives navigation between rooms — which
 * means the layout never re-renders with a new room id, and the highlight has
 * to come from the path rather than from props.
 *
 * People and places are listed apart. A direct message is somebody, a channel
 * is somewhere, and a single list mixing the two makes you read every row to
 * find either.
 */
export function ChatRoomList({ rooms }: { rooms: Room[] }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const matching = needle
    ? rooms.filter(
        (r) =>
          r.title.toLowerCase().includes(needle) ||
          (r.excerpt?.toLowerCase().includes(needle) ?? false),
      )
    : rooms;

  const withActive = matching.map((room) => ({
    ...room,
    active: pathname === room.href,
  }));
  const direct = withActive.filter((r) => r.kind === "direct");
  const channels = withActive.filter((r) => r.kind === "channel");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-3 pb-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-600"
            strokeWidth={1.75}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-9 w-full rounded-lg border border-gray-400 bg-background-100 pl-9 pr-3 text-body text-gray-1000 placeholder:text-gray-600 focus-visible:border-blue-700 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {withActive.length === 0 ? (
          <p className="px-4 py-8 text-center text-caption text-gray-600">
            {needle ? "Nothing matches that." : "No conversations yet."}
          </p>
        ) : (
          <>
            <Section label="Direct messages" rooms={direct} />
            <Section label="Groups" rooms={channels} />
          </>
        )}
      </div>
    </div>
  );
}

/** A heading only appears when it has something under it. */
function Section({ label, rooms }: { label: string; rooms: RoomListItemData[] }) {
  if (rooms.length === 0) return null;
  return (
    <section>
      <h2 className="px-5 pb-1 pt-3 text-caption-strong uppercase tracking-[0.08em] text-gray-600">
        {label}
      </h2>
      <RoomList rooms={rooms} />
    </section>
  );
}
