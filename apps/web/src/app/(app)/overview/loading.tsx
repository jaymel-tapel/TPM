import { Skeleton } from "@meridian/ui/primitives/skeleton";
import { StatBandSkeleton } from "@meridian/ui";

export default function Loading() {
  return (
    <div className="space-y-10">
      {/* The navy hero keeps its colour while loading so the page does not
          flash from light to dark once the data lands. */}
      <div className="rounded-12 bg-navy px-8 py-8">
        <Skeleton className="h-3 w-40 bg-white/10" />
        <div className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Skeleton className="h-20 w-40 bg-white/10" />
            <Skeleton className="h-4 w-52 bg-white/10" />
            <Skeleton className="h-12 w-full bg-white/10" />
          </div>
          <Skeleton className="h-36 w-full bg-white/10" />
        </div>
      </div>
      <StatBandSkeleton items={2} />
      <StatBandSkeleton items={4} />
    </div>
  );
}
