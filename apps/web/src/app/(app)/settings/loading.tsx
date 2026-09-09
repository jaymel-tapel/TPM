import { Skeleton } from "@meridian/ui/primitives/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-6 rounded-xl border border-gray-400 bg-background-100 p-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}
