import { InboxList } from "@meridian/ui";
import { Button } from "@meridian/ui/primitives/button";
import { requireUser } from "@/lib/auth";
import { getInbox, getUnreadCount } from "@/queries/notifications";
import { toInboxItem } from "@/lib/present";
import { markAllRead, openNotification } from "@/actions/notifications";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await requireUser();
  const [unread, entries] = await Promise.all([
    getUnreadCount(user.id),
    getInbox(user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-baseline gap-3">
        <h1 className="text-title-2 text-gray-1000">Inbox</h1>
        <span className="tabular text-caption text-gray-600">
          {unread > 0 ? `${unread} unread` : "All caught up"}
        </span>
        {unread > 0 ? (
          <form action={markAllRead} className="ml-auto">
            <Button type="submit" variant="outline" size="sm">
              Mark all as read
            </Button>
          </form>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-400 bg-background-100">
        <InboxList
          items={entries.map((entry) => toInboxItem(entry))}
          onOpen={openNotification}
          empty="Nothing has needed you yet. Mentions, assignments and comments on your work land here."
        />
      </div>
    </div>
  );
}
