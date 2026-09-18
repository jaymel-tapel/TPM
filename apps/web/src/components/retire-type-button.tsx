"use client";

import { useActionState } from "react";
import { Button } from "@tpm/ui/primitives/button";
import { setTaskTypeRetired, type FormState } from "@/actions/vocabulary";

/** Retire a kind, or bring it back. Never a delete — see the action. */
export function RetireTypeButton({ id, retired }: { id: string; retired: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setTaskTypeRetired, null);

  return (
    <div className="shrink-0 text-right">
      <form action={action}>
        <input type="hidden" name="typeId" value={id} />
        <input type="hidden" name="retire" value={retired ? "0" : "1"} />
        <Button type="submit" size="sm" variant="ghost" disabled={pending}>
          {retired ? "Bring back" : "Retire"}
        </Button>
      </form>
      {state?.error ? (
        <p role="alert" className="mt-1 max-w-56 text-caption text-red-700">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
