import { MessagesSquare } from "lucide-react";
import { ButtonLink } from "@meridian/ui";

export const dynamic = "force-dynamic";

/** Nothing open yet. The list is already on screen, so this only has to say so. */
export default function ChatPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <MessagesSquare className="size-8 text-gray-500" strokeWidth={1.5} />
      <p className="text-title-3 text-gray-1000">Pick a conversation</p>
      <p className="max-w-sm text-body text-gray-600">
        For the things that are not about one task — so they stay here instead
        of leaving for Slack.
      </p>
      <ButtonLink href="/chat/new" className="mt-2">
        New conversation
      </ButtonLink>
    </div>
  );
}
