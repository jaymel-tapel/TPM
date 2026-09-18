import { Skeleton } from "@tpm/ui/primitives/skeleton";

/** Three groups — running, booked, wrapped — the way the page arranges them. */
export default function Loading() {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      {[2, 1, 1].map((rows, group) => (
        <div key={group} className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="divide-y divide-gray-300 overflow-hidden rounded-lg border border-gray-400 bg-background-100">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-4">
                <div className="w-64 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-1.5 w-full" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
