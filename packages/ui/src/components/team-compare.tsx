import Link from "next/link";
import { Progress } from "../primitives/progress";
import { DeltaBadge } from "./delta-badge";
import { UserAvatar } from "./user-avatar";

export type TeamCompareData = {
  id: string;
  href: string;
  name: string;
  directorName: string | null;
  percent: number;
  overdue: number;
  /** Percentage points, this week against the one before. */
  delta: number;
};

/**
 * Both teams on one shared scale, one row each. Two separate cards make 81%
 * and 77% look identical; stacked bars against the same axis do not.
 *
 * Every column after the bar is a fixed width. An `auto` column would size to
 * its own row's content — "No change vs last week" is wider than "↓10% vs last
 * week" — giving each row a different track and quietly destroying the shared
 * axis this component exists to provide.
 */
export function TeamCompare({ teams }: { teams: TeamCompareData[] }) {
  return (
    <div className="divide-y divide-gray-300 overflow-hidden rounded-xl border border-gray-400 bg-background-100">
      {teams.map((team) => (
        <Link
          key={team.id}
          href={team.href}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 px-6 py-4 transition-colors hover:bg-gray-100 lg:grid-cols-[168px_minmax(0,34rem)_96px_minmax(192px,1fr)]"
        >
          <div className="min-w-0">
            <div className="text-subtitle-2 text-gray-1000">{team.name}</div>
            <div className="mt-1 flex items-center gap-2">
              {team.directorName ? <UserAvatar name={team.directorName} size="xs" /> : null}
              <span className="truncate text-caption text-gray-600">
                {team.directorName ?? "No director"}
              </span>
            </div>
          </div>

          <div className="col-span-2 flex items-center gap-4 lg:col-span-1">
            <Progress value={team.percent} className="h-2 min-w-0 flex-1" />
            <span className="tabular w-12 shrink-0 text-right text-subtitle-1 text-gray-1000">
              {team.percent}%
            </span>
          </div>

          <div className="tabular text-right text-caption text-gray-600">
            <span className={team.overdue > 0 ? "text-red-700" : undefined}>{team.overdue}</span>{" "}
            overdue
          </div>

          <div className="justify-self-end">
            <DeltaBadge value={team.delta} />
          </div>
        </Link>
      ))}
    </div>
  );
}
