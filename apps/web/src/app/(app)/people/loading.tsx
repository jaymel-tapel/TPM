import { Skeleton } from "@tpm/ui/primitives/skeleton";
import { MemberListSkeleton } from "@tpm/ui";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-20" />
        <MemberListSkeleton rows={8} />
      </div>
    </div>
  );
}
