import { Skeleton } from "@meridian/ui/primitives/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl">
      <Skeleton className="mb-6 h-8 w-32" />
      <div className="space-y-px rounded-xl border border-gray-400 bg-background-100 p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
