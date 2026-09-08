"use client";

import { useActionState, useState } from "react";
import { Button } from "@meridian/ui/primitives/button";
import { Input } from "@meridian/ui/primitives/input";
import { Label } from "@meridian/ui/primitives/label";
import { ButtonLink, Panel } from "@meridian/ui";
import { createBoard } from "@/actions/boards";

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";

export function NewBoardForm({
  teams,
  fixedTeam,
}: {
  /** Teams this person may file a board under. Empty for an Account Director. */
  teams: { id: string; name: string }[];
  /** An Account Director has exactly one team and no choice to make. */
  fixedTeam?: { id: string; name: string };
}) {
  const [state, action] = useActionState(createBoard, null);
  // Empty string is the department: a board that belongs to no team.
  const [teamId, setTeamId] = useState(fixedTeam?.id ?? "");

  return (
    <Panel className="max-w-xl p-6">
      <form action={action} className="space-y-6">
        {fixedTeam ? <input type="hidden" name="teamId" value={fixedTeam.id} /> : null}

        {fixedTeam ? null : (
          <div>
            <Label htmlFor="teamId" className={label}>
              Whose board
            </Label>
            <select
              id="teamId"
              name="teamId"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-400 bg-background-100 px-3 text-body text-gray-1000 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {/* Not a blank option — belonging to nobody is the choice. */}
              <option value="">The department</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-caption text-gray-600">
              A team&rsquo;s board is scoped to that team. A department board has
              nothing to scope it by, so everyone can see the work on it and
              anyone can be put on it.
            </p>
          </div>
        )}

        <div>
          <Label htmlFor="name" className={label}>
            Board name
          </Label>
          <Input id="name" name="name" required autoFocus placeholder="Nike launch" />
          <p className="mt-2 text-caption text-gray-600">
            {fixedTeam ? `For ${fixedTeam.name}. ` : ""}It starts with the four
            standard columns — rename or replace them afterwards.
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
