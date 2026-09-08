"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@meridian/ui/primitives/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@meridian/ui/primitives/dialog";
import { resetPassword } from "@/actions/admin";

/**
 * Asks first, because it takes effect immediately: the old password stops
 * working and so does every session opened with it. The new one is shown once
 * here and stored only as a hash — there is nowhere to read it back from.
 */
export function ResetPassword({
  userId,
  name,
  isSelf,
}: {
  userId: string;
  name: string;
  /** Resetting your own password signs you out, which is worth saying first. */
  isSelf: boolean;
}) {
  const [state, formAction, pending] = useActionState(resetPassword, null);

  if (state?.created) {
    return (
      <div className="rounded-xl border border-gray-400 bg-background-100 p-6">
        <h2 className="text-subtitle-2 text-gray-1000">New password for {state.created.name}</h2>
        <p className="mt-2 max-w-prose text-body text-gray-700">
          Hand it over. It is shown once and stored only as a hash, so it cannot be read back
          — if it is lost, reset again. Their old password and any session opened with it have
          stopped working.
        </p>
        <p className="mt-4 rounded-md border border-gray-400 bg-gray-100 px-3 py-2 font-mono text-body-lg text-gray-1000 select-all">
          {state.created.password}
        </p>
        {isSelf ? (
          <p className="mt-4 text-caption text-gray-700">
            That was your own account, so you are now signed out. Sign in again with this.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-2 text-gray-700">
            <KeyRound className="size-4 shrink-0" strokeWidth={1.75} />
            Reset password
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset {name}&rsquo;s password?</DialogTitle>
          <DialogDescription>
            {isSelf ? (
              <>
                This is your own account. Your current password stops working and you will be
                signed out, here and everywhere else.
              </>
            ) : (
              <>
                <span className="text-gray-1000">{name}</span>&rsquo;s current password stops
                working immediately, and so does any session they have open. You will get a new
                one to hand over, shown once.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {state?.error ? (
          <p className="rounded-md bg-red-100 px-3 py-2 text-body text-red-900">{state.error}</p>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <form action={formAction}>
            <input type="hidden" name="userId" value={userId} />
            <Button type="submit" disabled={pending}>
              {pending ? "Resetting…" : "Reset password"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
