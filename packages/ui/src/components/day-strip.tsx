import Link from "next/link";
import { cn } from "../lib/utils";

export type DayChipData = {
  href: string;
  /** "Tue" */
  weekday: string;
  /** "9" */
  day: string;
  /** How much is already planned, so a full day reads as full. */
  count: number;
  active: boolean;
  today: boolean;
};

/**
 * Which day the plan is showing.
 *
 * Links rather than state: the day is in the URL, so it survives a reload and
 * can be sent to someone. The count is the point — "is Thursday already full"
 * is the question you are actually asking when you plan ahead.
 */
export function DayStrip({ days }: { days: DayChipData[] }) {
  return (
    <nav aria-label="Pick a day" className="mb-3 flex gap-1">
      {days.map((d) => (
        <Link
          key={d.href}
          href={d.href}
          aria-current={d.active ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center rounded-md border px-1 py-2 transition-colors",
            d.active
              ? "border-blue-700 bg-blue-100 text-gray-1000"
              : "border-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-1000",
          )}
        >
          <span className="text-caption text-gray-600">{d.weekday}</span>
          <span
            className={cn(
              "tabular text-body-strong",
              // Today is marked whether or not it is the day being shown, so
              // you never lose your place in the week.
              d.today && !d.active && "text-blue-700",
            )}
          >
            {d.day}
          </span>
          {/* A dot, not a number: at this size the count is a sense of how
              full the day is, and the grid itself gives the detail. */}
          <span
            aria-label={d.count === 1 ? "1 planned" : `${d.count} planned`}
            className={cn(
              "mt-1 h-1 w-4 rounded-full",
              d.count === 0 ? "bg-transparent" : d.count > 3 ? "bg-blue-700" : "bg-blue-500",
            )}
          />
        </Link>
      ))}
    </nav>
  );
}
