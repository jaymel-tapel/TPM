import { Skeleton } from "@meridian/ui/primitives/skeleton";

/**
 * A board, before it arrives. Four columns because every board has at least
 * the four the product ships with, and cards of decreasing height because a
 * real column is ragged — a grid of identical blocks reads as a pattern rather
 * than as work loading.
 */
export default function Loading() {
  const cards = [3, 2, 4, 1];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64" />
      </div>

      {/* The one bar: views, then filters, then the verbs. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-300 pb-3">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="ml-auto h-7 w-24" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((n, column) => (
          <div key={column} className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            {Array.from({ length: n }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
