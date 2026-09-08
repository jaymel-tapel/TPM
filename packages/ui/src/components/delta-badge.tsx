import { cn } from "../lib/utils";

/**
 * A week-over-week change in completion. Zero is not an improvement, so it
 * reads neutral rather than green — the most common way a delta chip lies.
 */
export function DeltaBadge({
  value,
  suffix = "vs last week",
  tone = "light",
}: {
  /** Percentage points, signed. */
  value: number;
  suffix?: string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";

  if (value === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-caption-strong",
          dark ? "bg-white/10 text-white/70" : "bg-gray-100 text-gray-700",
        )}
      >
        No change {suffix}
      </span>
    );
  }

  const up = value > 0;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-caption-strong",
        up
          ? dark
            ? "bg-green-700/25 text-green-200"
            : "bg-green-100 text-green-900"
          : dark
            ? "bg-red-700/25 text-red-200"
            : "bg-red-100 text-red-900",
      )}
    >
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      {Math.abs(value)}% {suffix}
    </span>
  );
}
