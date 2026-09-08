import { cn } from "../lib/utils";
import type { TrendPointData } from "../types";

/**
 * Seven days of completion at a glance. Deliberately not a chart: no axes, no
 * tooltip, no legend — it answers "which way are we going" and hands the
 * detail to the report.
 *
 * Completion rates cluster in a narrow band (a department rarely swings from
 * 20% to 95%), so a 0–100 scale would draw seven identical bars. The strip
 * zooms to the data instead, and states the range it is using so the
 * truncation is declared rather than hidden.
 */
export function TrendStrip({
  data,
  tone = "light",
}: {
  data: TrendPointData[];
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  const values = data.map((d) => d.percent);
  const floor = Math.max(0, Math.floor((Math.min(...values) - 8) / 5) * 5);
  const span = Math.max(1, 100 - floor);

  const emphasis = (last: boolean) =>
    last
      ? dark
        ? "text-amber-500"
        : "text-blue-700"
      : dark
        ? "text-white/50"
        : "text-gray-600";

  return (
    <div>
      {/* Values, then bars sitting on a shared baseline. */}
      <div
        className={cn(
          "flex items-end gap-2 border-b",
          dark ? "border-white/20" : "border-gray-400",
        )}
      >
        {data.map((point, i) => {
          const last = i === data.length - 1;
          return (
            <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
              <span className={cn("tabular text-caption-strong", emphasis(last))}>
                {point.percent}%
              </span>
              <div
                className="flex h-20 w-full items-end"
                title={`${point.label}: ${point.percent}% — ${point.done} of ${point.due} completed`}
              >
                <div
                  className={cn(
                    "w-full rounded-t-6",
                    last
                      ? dark
                        ? "bg-amber-500"
                        : "bg-blue-700"
                      : dark
                        ? "bg-white/30"
                        : "bg-blue-300",
                  )}
                  // A floor so the weakest day still reads as a bar.
                  style={{ height: `${Math.max(6, ((point.percent - floor) / span) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Day labels live below the baseline, not between it and the bars. */}
      <div className="mt-2 flex gap-2">
        {data.map((point, i) => {
          const last = i === data.length - 1;
          return (
            <span
              key={point.label}
              className={cn(
                "flex-1 text-center text-caption-strong",
                last ? (dark ? "text-white" : "text-gray-1000") : dark ? "text-white/45" : "text-gray-600",
              )}
            >
              {point.label}
            </span>
          );
        })}
      </div>

      <p className={cn("mt-3 text-caption-strong", dark ? "text-white/35" : "text-gray-500")}>
        Scaled {floor}–100%
      </p>
    </div>
  );
}
