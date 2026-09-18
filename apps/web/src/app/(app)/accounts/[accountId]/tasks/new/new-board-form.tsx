"use client";

import { useActionState } from "react";
import { Button } from "@tpm/ui/primitives/button";
import { Input } from "@tpm/ui/primitives/input";
import { Label } from "@tpm/ui/primitives/label";
import { ButtonLink } from "@tpm/ui";
import { createBoard } from "@/actions/boards";

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";

export function NewBoardForm({ accountId }: { accountId: string }) {
  const [state, action, pending] = useActionState(createBoard, null);

  return (
    <form action={action} className="space-y-6 rounded-xl border border-gray-400 bg-background-100 p-6">
      <input type="hidden" name="accountId" value={accountId} />

      <div className="max-w-md">
        <Label htmlFor="name" className={label}>
          Name
        </Label>
        <Input id="name" name="name" required placeholder="Performance &amp; Media" autoFocus />
        <p className="mt-2 text-caption text-gray-600">
          What the work on it has in common — a pipeline, not a campaign. Campaigns
          are dated pushes and live on the Campaigns page.
        </p>
      </div>

      {state?.error ? (
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-body text-red-900">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-4 border-t border-gray-300 pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create board"}
        </Button>
        <ButtonLink href={`/accounts/${accountId}/tasks`} variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
