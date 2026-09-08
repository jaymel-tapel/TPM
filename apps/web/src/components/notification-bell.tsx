"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { InboxList, type InboxItemData } from "@meridian/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@meridian/ui/primitives/dropdown-menu";
import { openNotification } from "@/actions/notifications";

/**
 * The bell, in the brand row.
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
        // Not a `Button`: this sits in a 24px-tall row and needs to read as an
        // icon, not a control.
        className="relative ml-auto rounded-md p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-1000"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="size-4" strokeWidth={1.75} />
        {unread > 0 ? (
          <span className="tabular absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-blue-700 px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-80 p-0">
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
