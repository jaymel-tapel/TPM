import { MemberListSkeleton, PageHeaderSkeleton, StatBandSkeleton } from "@tpm/ui";

export default function Loading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <StatBandSkeleton />
      <MemberListSkeleton rows={6} />
    </div>
  );
}
