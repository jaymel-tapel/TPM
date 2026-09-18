import { MemberListSkeleton, PageHeaderSkeleton } from "@tpm/ui";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <MemberListSkeleton rows={3} />
    </>
  );
}
