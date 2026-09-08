"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageSquare, RotateCcw, UserMinus, UserPlus } from "lucide-react";
import { Button } from "../primitives/button";
import { cn } from "../lib/utils";
import { RichTextEditor, RichTextView } from "../editor";
import { UserAvatar } from "./user-avatar";
import type { ActivityItemData, ActivityKind } from "../types";

const EVENT_ICON: Record<Exclude<ActivityKind, "comment">, typeof ArrowRight> = {
  created: MessageSquare,
  status_changed: ArrowRight,
  completed: CheckCircle2,
  reopened: RotateCcw,
  assigned: UserPlus,
  unassigned: UserMinus,
  board_changed: ArrowRight,
};

/**
 * What an event says, in the past tense, as one line.
 *
 * The labels are snapshots taken when it happened, so a column renamed since
 * still reads the way it read then — which is the point of keeping a log.
 */
function eventText(item: ActivityItemData): React.ReactNode {
  const to = <span className="text-gray-1000">{item.toLabel}</span>;
  const from = <span className="text-gray-1000">{item.fromLabel}</span>;

  switch (item.kind) {
    case "created":
      return <>created this in {to}</>;
    case "status_changed":
      return item.fromLabel ? <>moved this from {from} to {to}</> : <>moved this to {to}</>;
    case "completed":
      return <>completed this</>;
    case "reopened":
      return <>reopened this</>;
    case "assigned":
      return <>assigned <span className="text-gray-1000">{item.subjectName}</span></>;
    case "unassigned":
      return <>unassigned <span className="text-gray-1000">{item.subjectName}</span></>;
    case "board_changed":
      return <>moved this to the {to} board</>;
    default:
      return null;
  }
}

function Event({ item }: { item: ActivityItemData }) {
  const Icon = EVENT_ICON[item.kind as Exclude<ActivityKind, "comment">] ?? ArrowRight;
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <Icon className="size-3.5 shrink-0 text-gray-600" strokeWidth={1.75} />
      <p className="min-w-0 flex-1 truncate text-caption text-gray-700">
        <span className="text-gray-1000">{item.actorName}</span> {eventText(item)}
      </p>
      <span className="shrink-0 text-caption text-gray-600">{item.when}</span>
    </li>
  );
}

function Comment({
  item,
  onDelete,
}: {
  item: ActivityItemData;
  onDelete?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <li className="flex gap-3 px-4 py-4">
      <UserAvatar name={item.actorName} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-body-strong text-gray-1000">{item.actorName}</span>
          <span className="text-caption text-gray-600">{item.when}</span>
          {item.removable && onDelete ? (
            <form action={onDelete} className="ml-auto">
              <input type="hidden" name="activityId" value={item.id} />
              <button
                type="submit"
                className="rounded-md px-1 text-caption text-gray-600 transition-colors hover:bg-gray-100 hover:text-red-700"
              >
                Delete
              </button>
            </form>
          ) : null}
        </div>
        <div className="mt-1">
          <RichTextView value={item.body} />
        </div>
      </div>
    </li>
  );
}

/**
 * A task's stream: what people said and what happened, oldest first.
 *
 * Events are one line and no editor. Comments each mount a BlockNote instance
 * to render, which is why the app caps how many arrive rather than handing this
 * component every comment a long-running task ever collected.
 */
export function ActivityFeed({
  items,
  total,
  moreHref,
  onComment,
  onDelete,
  pending,
  error,
}: {
  items: ActivityItemData[];
  /** Everything on the task, so the gap can be named rather than hidden. */
  total?: number;
  moreHref?: string;
  /**
   * Posts the comment. Resolves true when it landed — the composer keeps what
   * was typed on anything else, because throwing away someone's words because
   * the server said no is the worst thing a comment box can do.
   */
  onComment?: (formData: FormData) => Promise<boolean>;
  onDelete?: (formData: FormData) => void | Promise<void>;
  pending?: boolean;
  error?: string | null;
}) {
  const hidden = (total ?? items.length) - items.length;

  return (
    <div className="rounded-xl border border-gray-400 bg-background-100">
      <div className="flex items-center gap-2 border-b border-gray-300 px-4 py-3">
        <MessageSquare className="size-4 text-gray-700" />
        <h2 className="text-body-strong text-gray-1000">Activity</h2>
        <span className="tabular ml-auto text-caption text-gray-600">
          {total ?? items.length}
        </span>
      </div>

      {hidden > 0 && moreHref ? (
        <div className="border-b border-gray-300 px-4 py-2 text-center">
          <Link
            href={moreHref}
            className="text-caption text-gray-700 underline-offset-2 hover:underline"
          >
            Show {hidden} earlier {hidden === 1 ? "entry" : "entries"}
          </Link>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-caption text-gray-600">
          Nothing has happened yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-300">
          {items.map((item) =>
            item.kind === "comment" ? (
              <Comment key={item.id} item={item} onDelete={onDelete} />
            ) : (
              <Event key={item.id} item={item} />
            ),
          )}
        </ul>
      )}

      {onComment ? <Composer onComment={onComment} pending={pending} error={error} /> : null}
    </div>
  );
}

function Composer({
  onComment,
  pending,
  error,
}: {
  onComment: (formData: FormData) => Promise<boolean>;
  pending?: boolean;
  error?: string | null;
}) {
  // Remounting the editor is how it gets cleared: BlockNote owns its document
  // and has no reset. Only on success — a failed post keeps the text.
  const [round, setRound] = useState(0);

  return (
    <form
      action={async (formData) => {
        if (await onComment(formData)) setRound((n) => n + 1);
      }}
      className="border-t border-gray-300 p-4"
    >
      <RichTextEditor
        key={round}
        name="body"
        placeholder="Write a comment…"
        className={cn(pending && "opacity-60")}
      />
      {error ? (
        <p role="alert" className="mt-2 text-caption text-red-700">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Posting…" : "Comment"}
        </Button>
      </div>
    </form>
  );
}
