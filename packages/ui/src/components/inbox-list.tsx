import { AtSign, MessageSquare, UserPlus } from "lucide-react";
import { cn } from "../lib/utils";
import { UserAvatar } from "./user-avatar";
import type { InboxItemData } from "../types";

const KIND_ICON = {
  mentioned: AtSign,
  assigned: UserPlus,
  commented: MessageSquare,
} as const;

/** What each kind claims, in the words the recipient cares about. */
function said(item: InboxItemData): string {
  switch (item.kind) {
    case "mentioned":
      return "mentioned you";
    case "assigned":
      return "assigned you";
    default:
      return "commented on your task";
  }
}

/**
 * Someone's inbox, newest first.
 *
 * Rendered at two densities from one component — `compact` for the bell's
 * dropdown, full for the page — because two components would drift and the
 * dropdown is where people will actually read these.
 *
 * Each row is a form rather than a link: following a notification marks it
 * read, and that is a write. It also means the whole thing works with no
 * JavaScript.
 */
export function InboxList({
  items,
  onOpen,
  compact = false,
  empty = "Nothing needs you right now.",
}: {
  items: InboxItemData[];
  onOpen: (formData: FormData) => void | Promise<void>;
  compact?: boolean;
  empty?: string;
}) {
  if (items.length === 0) {
    return (
      <p className={cn("text-caption text-gray-600", compact ? "px-3 py-6 text-center" : "py-10 text-center")}>
        {empty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-300">
      {items.map((item) => {
        const Icon = KIND_ICON[item.kind];
        return (
          <li key={item.id}>
            <form action={onOpen}>
              <input type="hidden" name="notificationId" value={item.id} />
              <button
                type="submit"
                className={cn(
                  "flex w-full items-start gap-3 text-left transition-colors hover:bg-gray-100",
                  compact ? "px-3 py-2.5" : "px-4 py-3.5",
                  // Unread is carried by weight and a dot, not by colour alone.
                  !item.read && "bg-blue-100/40",
                )}
              >
                <span className="relative mt-0.5 shrink-0">
                  <UserAvatar name={item.actorName} size={compact ? "sm" : "md"} />
                  <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border border-background-100 bg-gray-200">
                    <Icon className="size-2.5 text-gray-700" strokeWidth={2.25} />
                  </span>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "min-w-0 truncate text-caption",
                        item.read ? "text-gray-700" : "text-body-strong text-gray-1000",
                      )}
                    >
                      <span className="text-gray-1000">{item.actorName}</span> {said(item)}
                    </span>
                    <span className="ml-auto shrink-0 text-caption text-gray-600">
                      {item.when}
                    </span>
                  </span>

                  {item.excerpt ? (
                    <span className="mt-0.5 block truncate text-caption text-gray-700">
                      {item.excerpt}
                    </span>
                  ) : null}

                  <span className="mt-0.5 block truncate text-caption text-gray-600">
                    {item.taskTitle}
                  </span>
                </span>

                {!item.read ? (
                  <span
                    aria-label="Unread"
                    className="mt-2 size-2 shrink-0 rounded-full bg-blue-700"
                  />
                ) : null}
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
