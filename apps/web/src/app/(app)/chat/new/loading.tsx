import { Skeleton } from "@meridian/ui/primitives/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-4 h-10 w-full max-w-md" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
