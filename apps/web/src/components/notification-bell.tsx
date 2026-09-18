"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { InboxList, cn, type InboxItemData } from "@tpm/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@tpm/ui/primitives/dropdown-menu";
import { openNotification } from "@/actions/notifications";

/**
 * The bell, in the rail beside Chat.
 *
 * It reads as a row rather than an icon — a bare bell tucked beside the
 * wordmark was easy to miss, and this is the one control whose whole job is to
 * be noticed. Labelled, full width, with the count where a count belongs. It
 * sits with Chat because those are the product's two queues, and above the
 * accounts because neither of them should move as the client list grows.
 *
 * Its contents are rendered on the server and handed down as props — the same
 * way the rail gets its boards — so opening it costs nothing and there is no
 * second data path to authorize. The dropdown shows the recent handful; the
 * page behind "See all" shows everything.
 */
export function NotificationBell({
  items,
  unread,
}: {
  items: InboxItemData[];
  unread: number;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        // Shaped like a nav item, because that is what it is now.
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-body-strong transition-colors",
          unread > 0
            ? "text-gray-1000 hover:bg-gray-100"
            : "text-gray-700 hover:bg-gray-100 hover:text-gray-1000",
        )}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="truncate">Notifications</span>
        {unread > 0 ? (
          <span className="tabular ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-blue-700 px-1.5 text-caption-strong text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      {/* Opens upward: there is nothing below it but the account row. */}
      <DropdownMenuContent side="top" align="start" className="w-96 p-0">
        <div className="flex items-center gap-2 border-b border-gray-300 px-3 py-2.5">
          <span className="text-body-strong text-gray-1000">Notifications</span>
          {unread > 0 ? (
            <span className="tabular ml-auto text-caption text-gray-600">{unread} unread</span>
          ) : null}
        </div>

        <div className="max-h-96 overflow-y-auto">
          <InboxList items={items} onOpen={openNotification} compact />
        </div>

        <div className="border-t border-gray-300 px-3 py-2 text-center">
          <Link
            href="/inbox"
            className="text-caption text-gray-700 underline-offset-2 hover:underline"
          >
            See all
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
