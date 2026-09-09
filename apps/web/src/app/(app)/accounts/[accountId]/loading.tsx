import { MemberListSkeleton, PageHeaderSkeleton, StatBandSkeleton } from "@meridian/ui";

export default function Loading() {
  return (
    <div className="space-y-10">
      <PageHeaderSkeleton />
      <StatBandSkeleton />
      <MemberListSkeleton rows={6} />
    </div>
  );
}
