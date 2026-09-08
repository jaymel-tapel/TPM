import Link from "next/link";
import { Progress } from "../primitives/progress";
import { cn } from "../lib/utils";
import { UserAvatar } from "./user-avatar";
import { ROLE_BADGES, type MemberRowData } from "../types";

/** One line per person: how much, how far, and whether anything slipped. */
export function MemberRow({ member }: { member: MemberRowData }) {
  const note =
    member.overdue > 0
      ? `${member.overdue} overdue`
      : member.due === 0
        ? "Nothing due today"
        : member.remaining === 0
          ? "Done for today"
          : `${member.remaining} remaining`;

  const noteTone =
    member.overdue > 0
      ? "text-red-700"
      : member.due > 0 && member.remaining === 0
        ? "text-green-700"
        : "text-gray-600";

  return (
    <Link
      href={member.href}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-gray-100 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,22rem)_96px_48px] sm:gap-x-6"
    >
      <UserAvatar name={member.name} size="md" />

      <div className="min-w-0">
        <div className="flex items-center gap-2 truncate text-body-strong text-gray-1000">
          {member.name}
          {ROLE_BADGES[member.role] ? (
            <span className="rounded-md bg-blue-100 px-1.5 text-caption-strong text-blue-900">
              {ROLE_BADGES[member.role]}
            </span>
          ) : null}
        </div>
        <div className={cn("text-caption", noteTone)}>{note}</div>
      </div>

      {/* The bar reports progress only. The red overdue count carries the
          warning, so colour stays meaningful. */}
      <Progress value={member.percent} className="hidden h-1.5 sm:block" />

      <div className="tabular hidden text-caption text-gray-600 sm:block">
        {member.done} / {member.due}
      </div>

      <div className="tabular text-right text-subtitle-2 text-gray-1000">{member.percent}%</div>
    </Link>
  );
}

export function MemberList({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-gray-300 overflow-hidden rounded-xl border border-gray-400 bg-background-100">
      {children}
    </div>
  );
}
