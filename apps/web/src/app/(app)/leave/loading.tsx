import { MemberListSkeleton, PageHeaderSkeleton } from "@meridian/ui";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <MemberListSkeleton rows={3} />
    </>
  );
}
