import { requireSession } from "@/lib/auth";
import { listChatPeople } from "@/queries/team";
import { NewConversationForm } from "./new-conversation-form";

export const dynamic = "force-dynamic";

export default async function NewConversationPage() {
  const { user } = await requireSession();
  // Everyone, including the Senior Director — see `listChatPeople`.
  const people = (await listChatPeople()).filter((p) => p.id !== user.id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-gray-300 bg-background-100 px-6 py-3">
        <h2 className="text-body-strong text-gray-1000">New conversation</h2>
        <p className="text-caption text-gray-600">Pick one person, or several for a group.</p>
      </header>

      <div className="min-h-0 flex-1 p-6">
        {/* Full height, not a scrolling column: the list is what scrolls, so
            the button to finish is always where you left it. */}
        <div className="mx-auto flex h-full min-h-0 max-w-2xl flex-col">
          <NewConversationForm people={people} />
        </div>
      </div>
    </div>
  );
}
