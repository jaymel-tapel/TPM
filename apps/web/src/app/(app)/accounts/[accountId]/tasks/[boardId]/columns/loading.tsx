import { Skeleton } from "@meridian/ui/primitives/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="divide-y divide-gray-300 overflow-hidden rounded-xl border border-gray-400 bg-background-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
