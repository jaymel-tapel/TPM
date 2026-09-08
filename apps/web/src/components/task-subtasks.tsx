"use client";

import { useActionState } from "react";
import { SubtaskList, type SubtaskData } from "@meridian/ui";
import { Button } from "@meridian/ui/primitives/button";
import { Input } from "@meridian/ui/primitives/input";
import { createSubtask, toggleTaskDone, type FormState } from "@/actions/tasks";

/**
 * Binds the subtask list to its actions, the way `task-attachments.tsx` does:
 * the presentational component never learns the parent's id, and the one
 * action that needs it gets it from a hidden field here.
 */
export function TaskSubtasks({
  parentId,
  subtasks,
  editable,
}: {
  parentId: string;
  subtasks: SubtaskData[];
  editable: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSubtask, null);

  return (
    <SubtaskList
      subtasks={subtasks}
      onToggle={editable ? toggleTaskDone : undefined}
      onAdd={
        editable ? (
          <form action={action} className="space-y-2">
            <input type="hidden" name="parentId" value={parentId} />
            <div className="flex gap-2">
              <Input
                name="title"
                placeholder="Anna — Data"
                aria-label="Subtask title"
                className="h-9 flex-1"
                // Cleared by the remount a successful save triggers.
                key={state === null ? "fresh" : "kept"}
              />
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Adding…" : "Add"}
              </Button>
            </div>
            {state?.error ? (
              <p role="alert" className="text-caption text-red-700">
                {state.error}
              </p>
            ) : null}
          </form>
        ) : null
      }
    />
  );
}
