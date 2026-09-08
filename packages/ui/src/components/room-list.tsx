import Link from "next/link";
import { Hash } from "lucide-react";
import { cn } from "../lib/utils";
import { UserAvatar } from "./user-avatar";
import type { RoomListItemData } from "../types";

/**
 * The conversations somebody is in, busiest first.
 *
 * Unread is a weight and a count rather than a colour, the way the inbox does
 * it — a count that only reads as a colour disappears for anyone who cannot see
 * the difference.
 */
export function RoomList({
  rooms,
  empty = "No conversations yet.",
}: {
  rooms: RoomListItemData[];
  empty?: string;
}) {
  if (rooms.length === 0) {
    return <p className="px-4 py-6 text-center text-caption text-gray-600">{empty}</p>;
  }

  return (
    <ul className="space-y-1 p-2">
      {rooms.map((room) => (
        <li key={room.id}>
          <Link
            href={room.href}
            aria-current={room.active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
              room.active ? "bg-blue-100" : "hover:bg-gray-100",
            )}
          >
            {/* A channel is a place and a person is a person, so one gets a
                tile and the other a face. */}
            {room.kind === "channel" ? (
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gray-200 text-gray-800">
                <Hash className="size-4" strokeWidth={2} />
              </span>
            ) : (
              <UserAvatar name={room.title} size="md" />
            )}

            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "min-w-0 truncate",
                    room.unread > 0
                      ? "text-body-strong text-gray-1000"
                      : "text-body text-gray-1000",
                  )}
                >
                  {room.title}
                </span>
                <span className="ml-auto shrink-0 text-caption text-gray-600">
                  {room.when}
                </span>
              </span>
              <span
                className={cn(
                  "mt-0.5 block truncate text-caption",
                  room.unread > 0 ? "text-gray-900" : "text-gray-600",
                )}
              >
                {room.excerpt ?? "Nothing said yet"}
              </span>
            </span>

            {room.unread > 0 ? (
              <span
                aria-label={`${room.unread} unread`}
                className="tabular grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-blue-700 px-1.5 text-caption-strong text-white"
              >
                {room.unread > 9 ? "9+" : room.unread}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
