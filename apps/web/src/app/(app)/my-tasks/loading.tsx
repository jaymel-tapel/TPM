import { Skeleton } from "@meridian/ui/primitives/skeleton";
import { PageHeaderSkeleton, TaskListSkeleton } from "@meridian/ui";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-md" />
        ))}
      </div>
      <TaskListSkeleton rows={5} />
    </>
  );
}
