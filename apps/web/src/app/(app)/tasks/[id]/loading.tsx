import { Skeleton } from "@meridian/ui/primitives/skeleton";
import { PageHeaderSkeleton, Panel } from "@meridian/ui";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-md" />
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <Panel className="space-y-6 p-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </Panel>
        <Panel className="p-6">
          <Skeleton className="h-72 w-full" />
        </Panel>
      </div>
    </>
  );
}
