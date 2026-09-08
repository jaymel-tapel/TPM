"use client";

import { useActionState } from "react";
import { Button } from "@meridian/ui/primitives/button";
import { Input } from "@meridian/ui/primitives/input";
import { Label } from "@meridian/ui/primitives/label";
import { ButtonLink, Panel } from "@meridian/ui";
import { createBoard } from "@/actions/boards";

export function NewBoardForm({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [state, action] = useActionState(createBoard, null);

  return (
    <Panel className="max-w-xl p-6">
      <form action={action} className="space-y-6">
        <input type="hidden" name="teamId" value={teamId} />

        <div>
          <Label
            htmlFor="name"
            className="mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600"
          >
            Board name
          </Label>
          <Input id="name" name="name" required autoFocus placeholder="Nike launch" />
          <p className="mt-2 text-caption text-gray-600">
            For {teamName}. It starts with the four standard columns — rename or replace them
            afterwards.
          </p>
          {state?.error ? (
            <p role="alert" className="mt-2 text-caption text-red-700">
              {state.error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit">Create board</Button>
          <ButtonLink href="/boards" variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </Panel>
  );
}
