import { Skeleton } from "@tpm/ui/primitives/skeleton";
import { MemberListSkeleton } from "@tpm/ui";

export default function Loading() {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>
      {/* The day/week switch. */}
      <Skeleton className="h-8 w-40" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <MemberListSkeleton rows={6} />
      </div>
    </div>
  );
}
