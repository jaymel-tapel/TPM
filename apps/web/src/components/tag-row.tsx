"use client";

import { useActionState, useState } from "react";
import { Button } from "@meridian/ui/primitives/button";
import { Input } from "@meridian/ui/primitives/input";
import { renameTag, setTagRetired, type FormState } from "@/actions/vocabulary";

/**
 * One tag on the admin list: what it is called, how much work carries it, and
 * the two things that can be done to it.
 *
 * Renaming happens in place rather than on a page of its own. A tag is a
 * single field, and a round trip to a form that holds one input is a longer
 * way of saying the same thing.
 */
export function TagRow({
  tag,
}: {
  tag: { id: string; name: string; taskCount: number; archivedAt: Date | null };
}) {
  const [renameState, rename, renaming] = useActionState<FormState, FormData>(renameTag, null);
  const [retireState, retire, retiring] = useActionState<FormState, FormData>(setTagRetired, null);
  const [editing, setEditing] = useState(false);
  const archived = tag.archivedAt !== null;
  const error = renameState?.error ?? retireState?.error;

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-4">
        {editing ? (
          <form action={rename} className="flex flex-1 items-center gap-2">
            <input type="hidden" name="tagId" value={tag.id} />
            <Input
              name="name"
              defaultValue={tag.name}
              aria-label={`Rename ${tag.name}`}
              autoFocus
              className="max-w-64 flex-1"
            />
            <Button type="submit" size="sm" disabled={renaming}>
              {renaming ? "Saving…" : "Save"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <span
              className={`min-w-0 flex-1 truncate text-body-strong ${
                archived ? "text-gray-600 line-through" : "text-gray-1000"
              }`}
            >
              {tag.name}
            </span>

            {/* The number is the whole reason this screen exists: it is what
                makes retiring a decision rather than a guess. */}
            <span className="tabular w-28 shrink-0 text-right text-caption text-gray-600">
              {tag.taskCount} {tag.taskCount === 1 ? "task" : "tasks"}
            </span>

            <div className="flex shrink-0 items-center gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Rename
              </Button>
              <form action={retire}>
                <input type="hidden" name="tagId" value={tag.id} />
                <input type="hidden" name="retire" value={archived ? "0" : "1"} />
                <Button type="submit" size="sm" variant="ghost" disabled={retiring}>
                  {archived ? "Bring back" : "Retire"}
                </Button>
              </form>
            </div>
          </>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-caption text-red-700">
          {error}
        </p>
      ) : null}
    </li>
  );
}
