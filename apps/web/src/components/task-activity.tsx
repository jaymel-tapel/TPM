"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActivityFeed, type ActivityItemData } from "@meridian/ui";
import { addComment, deleteActivity } from "@/actions/activity";
import { useMentionSource } from "@/components/doc-mention";

/**
 * The feed, bound to its actions. Commenting needs only view access, so the
 * composer is offered to anyone who can open the task — unlike the form above
 * it, which is gated on being able to edit.
 *
 * The action is called directly rather than through `useActionState` because
 * the composer has to know whether the post landed: it clears itself on
 * success and keeps what was typed on failure, and a dispatch that returns
 * void cannot tell it which happened.
 */
export function TaskActivity({
  taskId,
  accountId,
  items,
  total,
  moreHref,
}: {
  taskId: string;
  /** The task's account — who a comment here may name. Null on department work. */
  accountId: string | null;
  items: ActivityItemData[];
  total: number;
  moreHref?: string;
}) {
  const router = useRouter();
  const mentionSource = useMentionSource(accountId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function post(formData: FormData): Promise<boolean> {
    formData.set("taskId", taskId);
    const result = await addComment(null, formData);
    if (result?.error) {
      setError(result.error);
      return false;
    }
    setError(null);
    // The feed is server-rendered, so the new entry arrives with the refresh
    // rather than being spliced in here.
    startTransition(() => router.refresh());
    return true;
  }

  return (
    <ActivityFeed
      items={items}
      total={total}
      moreHref={moreHref}
      pending={pending}
      error={error}
      mentionSource={mentionSource}
      onDelete={deleteActivity}
      onComment={post}
    />
  );
}
