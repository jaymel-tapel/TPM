"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";
import { UserAvatar } from "./user-avatar";
import type { ChatMessageData } from "../types";

/**
 * One conversation, oldest at the top.
 *
 * Plain text, and no editor: `RichTextView` mounts a whole BlockNote instance
 * per call, which is why the activity feed caps itself at twenty comments. A
 * scrollback cannot pay that per message — and rich text is the first step
 * toward the messaging product the brief refused.
 *
 * The shape is the one everybody already knows from a messenger: your own words
 * on the right, everyone else's on the left behind their face, a divider where
 * the day changes, and the newest thing at the bottom where your eye lands.
 */
export function ChatThread({
  messages,
  onSend,
  onDelete,
  placeholder = "Type a message",
}: {
  messages: ChatMessageData[];
  /**
   * Sends it. Resolves true when it landed — the box keeps what was typed on
   * anything else, because throwing away someone's words is the worst thing a
   * message box can do.
   */
  onSend?: (formData: FormData) => Promise<boolean>;
  onDelete?: (formData: FormData) => void | Promise<void>;
  placeholder?: string;
}) {
  const [pending, setPending] = useState(false);
  const [empty, setEmpty] = useState(true);
  const box = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];

  /*
   * Stay at the bottom. A conversation opens at its end, not its beginning, and
   * a message that arrives while you are reading should not leave the screen —
   * keyed on the last message so it fires when one arrives, not on every
   * keystroke.
   */
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last?.id, messages.length]);

  async function submit(formData: FormData) {
    if (!onSend) return;
    setPending(true);
    const sent = await onSend(formData);
    setPending(false);
    if (sent && box.current) {
      box.current.value = "";
      box.current.style.height = "auto";
      setEmpty(true);
      box.current.focus();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <p className="text-body-strong text-gray-1000">No messages yet</p>
            <p className="text-caption text-gray-600">
              Say something — this is for the things that are not about one task.
            </p>
          </div>
        ) : (
          <ul className="mx-auto flex max-w-3xl flex-col">
            {messages.map((message) => (
              <li key={message.id}>
                {message.dayLabel ? (
                  <div
                    role="separator"
                    aria-label={message.dayLabel}
                    className="my-4 flex items-center gap-3"
                  >
                    <span className="h-px flex-1 bg-gray-300" />
                    <span className="text-caption text-gray-600">{message.dayLabel}</span>
                    <span className="h-px flex-1 bg-gray-300" />
                  </div>
                ) : null}

                <div
                  className={cn(
                    "group/msg flex items-end gap-2",
                    message.continues && !message.dayLabel ? "mt-0.5" : "mt-3",
                    message.mine ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  {/* A run from one person shows their face once; the gutter is
                      still held so the bubbles stay in one column. Your own
                      messages need no face — you know who you are. */}
                  {message.mine ? null : (
                    <span className="w-8 shrink-0">
                      {message.continues && !message.dayLabel ? null : (
                        <UserAvatar name={message.authorName} size="md" />
                      )}
                    </span>
                  )}

                  <div
                    className={cn(
                      "flex min-w-0 max-w-[min(36rem,80%)] flex-col",
                      message.mine ? "items-end" : "items-start",
                    )}
                  >
                    {message.continues && !message.dayLabel ? null : (
                      <span className="mb-1 flex items-baseline gap-2 px-1">
                        {message.mine ? null : (
                          <span className="text-caption-strong text-gray-900">
                            {message.authorName}
                          </span>
                        )}
                        <span className="text-caption text-gray-600">{message.when}</span>
                      </span>
                    )}

                    {/* Pre-wrap, so a message someone laid out in lines keeps
                        them without any of it being markup. */}
                    <span
                      className={cn(
                        "block whitespace-pre-wrap break-words px-3 py-2 text-body",
                        message.mine
                          ? "rounded-xl rounded-br-sm bg-blue-200 text-gray-1000"
                          : "rounded-xl rounded-bl-sm border border-gray-300 bg-background-100 text-gray-1000",
                      )}
                    >
                      {message.body}
                    </span>
                  </div>

                  {message.mine && onDelete ? (
                    <form action={onDelete} className="shrink-0">
                      <input type="hidden" name="messageId" value={message.id} />
                      <button
                        type="submit"
                        aria-label="Delete this message"
                        className="rounded-md p-1 text-gray-600 opacity-0 transition-opacity hover:bg-gray-100 hover:text-red-700 focus-visible:opacity-100 group-hover/msg:opacity-100"
                      >
                        <Trash2 className="size-4" strokeWidth={1.75} />
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {onSend ? (
        <form action={submit} className="shrink-0 px-6 pb-4 pt-2">
          {/* One box that contains the send button, rather than a field with a
              button beside it: the whole thing is the composer, and it takes
              the focus ring as a unit. */}
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-gray-400 bg-background-100 p-2 transition-colors focus-within:border-blue-700 focus-within:ring-3 focus-within:ring-ring/50">
            <textarea
              ref={box}
              name="body"
              rows={1}
              required
              placeholder={placeholder}
              aria-label="Message"
              onInput={(e) => {
                // Grows with what is being written, up to a point, so a long
                // message is not composed through a one-line slot.
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                setEmpty(el.value.trim().length === 0);
              }}
              onKeyDown={(e) => {
                // Enter sends; shift-Enter is a new line. The other way round
                // makes every quick reply a two-key gesture.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              className="max-h-40 min-h-8 flex-1 resize-none bg-transparent px-2 py-1 text-body text-gray-1000 placeholder:text-gray-600 focus-visible:outline-none"
            />
            <button
              type="submit"
              disabled={pending || empty}
              aria-label="Send"
              title="Send"
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-700 text-white transition-colors hover:bg-blue-800 disabled:bg-gray-300 disabled:text-gray-600"
            >
              <SendHorizontal className="size-4" strokeWidth={2} />
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
