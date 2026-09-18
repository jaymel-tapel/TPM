import { Skeleton } from "@tpm/ui/primitives/skeleton";
import { TaskListSkeleton } from "@tpm/ui";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />

      <div className="grid gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-8">
          <TaskListSkeleton rows={3} />
          <TaskListSkeleton rows={2} />
        </div>
        <aside className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </aside>
      </div>
    </div>
  );
}
