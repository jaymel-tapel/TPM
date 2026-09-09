import { Skeleton } from "@meridian/ui/primitives/skeleton";

/**
 * Tasks has no page of its own — it resolves the account's first board and
 * redirects. That still costs a round trip, and a blank screen for a round
 * trip reads as a dead link, so it borrows the board's own shape.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64" />
      </div>
      <Skeleton className="h-7 w-full max-w-2xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[3, 2, 4, 1].map((n, column) => (
          <div key={column} className="space-y-3">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: n }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
