"use client";

import { useActionState } from "react";
import { Button } from "@tpm/ui/primitives/button";
import { cancelLeave, decideLeave, type LeaveState } from "@/actions/leave";

/** Withdraw your own request. One button, one verb, nothing to confirm. */
export function CancelLeaveButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(cancelLeave, null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="requestId" value={id} />
      {state?.error ? (
        <span className="text-caption text-red-900">{state.error}</span>
      ) : null}
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Cancelling…" : "Cancel"}
      </Button>
    </form>
  );
}

/**
 * Approve or decline, in one form.
 *
 * Two submit buttons rather than two forms: a submit button's own `name` and
 * `value` are what get sent, so the note beside them belongs to whichever was
 * pressed and none of this needs JavaScript to decide.
 */
export function LeaveDecision({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<LeaveState, FormData>(
    decideLeave,
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="requestId" value={id} />
      {state?.error ? (
        <span className="text-caption text-red-900">{state.error}</span>
      ) : null}
      <Button
        type="submit"
        name="decision"
        value="declined"
        variant="ghost"
        size="sm"
        disabled={pending}
      >
        Decline
      </Button>
      <Button type="submit" name="decision" value="approved" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Approve"}
      </Button>
    </form>
  );
}
