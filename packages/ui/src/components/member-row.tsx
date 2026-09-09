import Link from "next/link";
import { cn } from "../lib/utils";
import { UserAvatar } from "./user-avatar";
import { AwayBadge } from "./availability";
import { WorkBar } from "./work-bar";
import { ROLE_BADGES, type MemberRowData } from "../types";

/** One line per person: how much, how far, and whether anything slipped. */
export function MemberRow({ member }: { member: MemberRowData }) {
  const away = member.away ?? null;

  /*
   * Somebody who is off has their absence as the note. Both are true — they
   * may well have work outstanding — but only one of them explains the row,
   * and it is not the one that reads as a reprimand for being on holiday.
   *
   * Everyone else gets the three counts, in the bar's own left-to-right order
   * so the words and the colours describe the same thing in the same
   * sequence. A zero is dropped rather than printed: "0 overdue" is noise on
   * fourteen rows out of fifteen.
   */
  const counts = [
    member.done > 0 ? `${member.done} done` : null,
    member.remaining > 0 ? `${member.remaining} remaining` : null,
    member.overdue > 0 ? `${member.overdue} overdue` : null,
  ].filter(Boolean);

  const note = away
    ? away.label
    : counts.length === 0
      ? "Nothing due today"
      : counts.join(" · ");

  /*
   * The clients somebody covers, on the one screen that reads people rather
   * than accounts. Inside an account's own Team page this is left off: every
   * row would say the account you are already looking at.
   */
  const accounts = member.accounts?.length ? member.accounts.join(", ") : null;

  const noteTone = away
    ? "text-gray-600"
    : member.overdue > 0
      ? "text-red-700"
      : member.due > 0 && member.remaining === 0
        ? "text-green-700"
        : "text-gray-600";

  const inner = (
    <>
      <UserAvatar name={member.name} size="md" />

      <div className="min-w-0">
        <div className="flex items-center gap-2 truncate text-body-strong text-gray-1000">
          {member.name}
          {/* Their craft, quiet and inline. It belongs beside the name rather
              than on a line of its own — a third line on a fifteen-person
              roster costs more than the fact is worth. */}
          {member.title ? (
            <span className="truncate text-caption font-normal text-gray-600">
              {member.title}
            </span>
          ) : null}
          {ROLE_BADGES[member.role] ? (
            <span className="rounded-md bg-blue-100 px-1.5 text-caption-strong text-blue-900">
              {ROLE_BADGES[member.role]}
            </span>
          ) : null}
          {away ? <AwayBadge away={away} /> : null}
        </div>
        <div className="flex items-center gap-1 truncate text-caption">
          <span className={noteTone}>{note}</span>
          {accounts ? <span className="truncate text-gray-600">· {accounts}</span> : null}
        </div>
      </div>

      {/*
        The bar carries the warning now, rather than deferring it to the note:
        a run of red across a roster is the thing you want to have registered
        before you have read a single name. What is still to do is the unpainted
        remainder, which is what an unfilled bar has always meant.

        It and the percentage deliberately measure different spans. `percent`
        is today's work only; the bar includes carried-over overdue, because
        the question it answers is "what does this person's day look like",
        not "how did today go".
      */}
      <WorkBar
        done={member.done}
        remaining={member.remaining}
        overdue={member.overdue}
        muted={Boolean(away)}
        className="hidden sm:flex"
      />

      {/*
        Dimmed on a day somebody was away, because a completion figure for a
        day they were not working is not a fact about them. Dimmed, not
        recomputed: this is the same number the rollup counted, and leave is
        never allowed to become a second definition of completion.
      */}
      <div
        className={cn(
          "tabular text-right text-subtitle-2",
          away ? "text-gray-500" : "text-gray-1000",
        )}
      >
        {member.percent}%
      </div>
    </>
  );

  const shape =
    "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,22rem)_48px] sm:gap-x-6";

  return member.href ? (
    <Link href={member.href} className={cn(shape, "transition-colors hover:bg-gray-100")}>
      {inner}
    </Link>
  ) : (
    <div className={shape}>{inner}</div>
  );
}

export function MemberList({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-gray-300 overflow-hidden rounded-xl border border-gray-400 bg-background-100">
      {children}
    </div>
  );
}
