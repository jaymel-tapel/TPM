import Link from "next/link";
import { Progress } from "../primitives/progress";
import { DeltaBadge } from "./delta-badge";
import { UserAvatar } from "./user-avatar";

export type CompareRowData = {
  id: string;
  href: string;
  name: string;
  /**
   * The quieter second line. An account names its director here; a director
   * names how many accounts they carry. Null renders nothing rather than a
   * placeholder — an empty line is quieter than the words "no director".
   */
  note: string | null;
  /**
   * Whose face sits beside the note, when a person is involved. Kept separate
   * from `note` because the two coincide for a director's row and diverge for
   * an account's, and inferring one from the other would break the moment a
   * note stopped being somebody's name.
   */
  avatarName?: string | null;
  percent: number;
  overdue: number;
  /** Percentage points, this week against the one before. */
  delta: number;
};

/**
 * Several things on one shared scale, one row each — accounts against each
 * other, or the Account Directors who carry them. Two separate cards make 81%
 * and 77% look identical; stacked bars against the same axis do not.
 *
 * Every column after the bar is a fixed width. An `auto` column would size to
 * its own row's content — "No change vs last week" is wider than "↓10% vs last
 * week" — giving each row a different track and quietly destroying the shared
 * axis this component exists to provide.
 */
export function CompareList({ rows }: { rows: CompareRowData[] }) {
  return (
    <div className="divide-y divide-gray-300 overflow-hidden rounded-xl border border-gray-400 bg-background-100">
      {rows.map((row) => (
        <Link
          key={row.id}
          href={row.href}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 px-6 py-4 transition-colors hover:bg-gray-100 lg:grid-cols-[168px_minmax(0,34rem)_96px_minmax(192px,1fr)]"
        >
          <div className="min-w-0">
            <div className="text-subtitle-2 text-gray-1000">{row.name}</div>
            {row.note ? (
              <div className="mt-1 flex items-center gap-2">
                {row.avatarName ? <UserAvatar name={row.avatarName} size="xs" /> : null}
                <span className="truncate text-caption text-gray-600">{row.note}</span>
              </div>
            ) : null}
          </div>

          <div className="col-span-2 flex items-center gap-4 lg:col-span-1">
            <Progress value={row.percent} className="h-2 min-w-0 flex-1" />
            <span className="tabular w-12 shrink-0 text-right text-subtitle-1 text-gray-1000">
              {row.percent}%
            </span>
          </div>

          <div className="tabular text-right text-caption text-gray-600">
            <span className={row.overdue > 0 ? "text-red-700" : undefined}>{row.overdue}</span>{" "}
            overdue
          </div>

          <div className="justify-self-end">
            <DeltaBadge value={row.delta} />
          </div>
        </Link>
      ))}
    </div>
  );
}
