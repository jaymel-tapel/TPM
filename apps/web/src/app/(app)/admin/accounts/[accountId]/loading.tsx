import { Skeleton } from "@meridian/ui/primitives/skeleton";
import { PageHeaderSkeleton } from "@meridian/ui";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="space-y-2 rounded-lg border border-gray-400 bg-background-100 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md" />
        ))}
      </div>
    </>
  );
}
