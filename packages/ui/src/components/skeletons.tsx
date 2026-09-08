import { Skeleton } from "../primitives/skeleton";
import { Panel } from "./section";

/**
 * Loading states are built from the components they stand in for, so the page
 * does not jump when the real thing arrives. Each one mirrors the layout of
 * its screen rather than being a generic spinner.
 */
export function TaskListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-gray-300 overflow-hidden rounded-xl border border-gray-400 bg-background-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="mt-0.5 size-5 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function MemberListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-gray-300 overflow-hidden rounded-xl border border-gray-400 bg-background-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="hidden h-1.5 flex-1 sm:block" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

export function StatBandSkeleton({ items = 4 }: { items?: number }) {
  return (
    <Panel className="p-8">
      <div className="flex flex-wrap gap-x-12 gap-y-6">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-8 space-y-3">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-80" />
    </div>
  );
}
