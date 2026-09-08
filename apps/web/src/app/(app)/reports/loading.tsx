import { Skeleton } from "@meridian/ui/primitives/skeleton";
import { PageHeaderSkeleton, Panel, StatBandSkeleton } from "@meridian/ui";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="space-y-10">
        <StatBandSkeleton items={6} />
        <Panel className="p-6">
          <Skeleton className="h-56 w-full" />
        </Panel>
        <div className="grid gap-8 lg:grid-cols-2">
          <StatBandSkeleton items={3} />
          <StatBandSkeleton items={3} />
        </div>
      </div>
    </>
  );
}
