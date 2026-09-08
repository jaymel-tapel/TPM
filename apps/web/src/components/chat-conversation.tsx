"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatThread, type ChatMessageData } from "@meridian/ui";
import { deleteMessage, markRoomRead, sendMessage } from "@/actions/chat";

/**
 * Binds a conversation to its actions, the way `task-activity.tsx` does.
 *
 * The action is called directly rather than through `useActionState` for the
 * same reason: the box has to know whether the message landed, so it can keep
 * what was typed when it did not.
 */
export function ChatConversation({
  roomId,
  viewerName,
  zone,
  messages,
}: {
  roomId: string;
  /** Whose name goes on a message that has not come back from the server yet. */
  viewerName: string;
  /** The reader's timezone, so the one message this side formats agrees with
   *  the ones the server formatted. */
  zone: string;
  messages: ChatMessageData[];
}) {
  const router = useRouter();
  /*
   * Messages that have been saved but not yet re-rendered from the server.
   *
   * A message you just sent has to appear at once — waiting a round trip to see
   * your own words is the thing that made this feel unlike a messenger. They
   * carry their real id, so the moment the server list contains them the copy
   * here is dropped rather than shown twice.
   */
  const [pendingSends, setPendingSends] = useState<ChatMessageData[]>([]);

  /*
   * Opening a conversation is reading it — but the cursor cannot move while the
   * page renders. `markRoomRead` calls `revalidatePath`, and Next refuses that
   * during a render; the room page threw its error boundary on every open.
   *
   * So it moves once the thread is on screen, which is also the more honest
   * moment: it fires after mount, the revalidation clears the rail's badge, and
   * a re-render from a later message does not fire it again.
   */
  useEffect(() => {
    // The refresh is what actually clears the rail's badge: the action's own
    // revalidation is raced by the render that is already in flight, and
    // without this the count sits there until the next thing you do.
    void markRoomRead(roomId).then(() => router.refresh());
  }, [roomId, router]);

  const known = new Set(messages.map((m) => m.id));
  const unseen = pendingSends.filter((m) => !known.has(m.id));

  // Reconcile in an effect rather than during render: dropping them here would
  // set state while rendering, and leaving them would grow the list forever.
  useEffect(() => {
    setPendingSends((current) => current.filter((m) => !known.has(m.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const shown = [...messages, ...unseen];
  const last = shown[shown.length - 1];

  return (
    <ChatThread
      messages={shown}
      onDelete={deleteMessage}
      onSend={async (formData) => {
        const body = String(formData.get("body") ?? "").trim();
        formData.set("roomId", roomId);
        const result = await sendMessage(formData);
        if ("error" in result) return false;

        setPendingSends((current) => [
          ...current,
          {
            id: result.id,
            authorName: viewerName,
            body,
            // The one message this side of the wire formats, and the server's
            // copy replaces it moments later. The reader's zone, not the browser's: a person in Manila
            // reading on London time should not see one message an hour — or
            // seven — out of step with the rest of the thread.
            when: new Date().toLocaleTimeString("en-US", {
              timeZone: zone,
              hour: "numeric",
              minute: "2-digit",
            }),
            mine: true,
            continues: Boolean(last?.mine),
            dayLabel: null,
          },
        ]);

        /*
         * Out of the action's own transition. Called inside it, React folds the
         * refresh into the transition already in flight and it never reaches
         * the server — which is why the room list kept showing the message
         * before this one.
         */
        setTimeout(() => router.refresh(), 0);
        return true;
      }}
    />
  );
}
