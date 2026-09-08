import { Skeleton } from "@meridian/ui/primitives/skeleton";
import { TaskListSkeleton } from "@meridian/ui";

export default function Loading() {
  return (
    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
      <div className="min-w-0 space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        <TaskListSkeleton rows={3} />
        <TaskListSkeleton rows={2} />
      </div>
      <aside className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-44 w-full rounded-12" />
      </aside>
    </div>
  );
}
