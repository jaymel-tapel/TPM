import { Skeleton } from "@meridian/ui/primitives/skeleton";

/** The empty state's shape, so landing on /chat does not flash a blank pane. */
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Skeleton className="h-4 w-56" />
    </div>
  );
}
