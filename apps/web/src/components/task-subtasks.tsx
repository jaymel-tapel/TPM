"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { SubtaskList, type SubtaskData } from "@meridian/ui";
import { Button } from "@meridian/ui/primitives/button";
import { Input } from "@meridian/ui/primitives/input";
import { createSubtask, toggleTaskDone, type FormState } from "@/actions/tasks";

/**
 * Binds the subtask list to its actions, the way `task-attachments.tsx` does:
 * the presentational component never learns the parent's id, and the one
 * action that needs it gets it from here.
 *
 * The creator is a field and a button rather than a form, because unframed
 * this renders inside the task form and a nested form is markup the browser
 * throws away — Add would have saved the whole task instead. So the payload is
 * built by hand and posted through `useActionState`'s dispatch, which is the
 * same call a form submission would have made.
 */
export function TaskSubtasks({
  parentId,
  subtasks,
  editable,
  framed = true,
}: {
  parentId: string;
  subtasks: SubtaskData[];
  editable: boolean;
  framed?: boolean;
}) {
  const [state, submit] = useActionState<FormState, FormData>(createSubtask, null);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");

  function add() {
    const trimmed = title.trim();
    if (!trimmed || pending) return;
    const data = new FormData();
    data.set("parentId", parentId);
    data.set("title", trimmed);
    // Cleared straight away: the row appears when the page revalidates, and a
    // title left sitting in the box reads as a piece that did not save.
    setTitle("");
    start(() => submit(data));
  }

  return (
    <SubtaskList
      subtasks={subtasks}
      framed={framed}
      onToggle={editable ? toggleTaskDone : undefined}
      onAdd={
        editable ? (
          <div className="space-y-2">
            {/*
              Both at the primitives' own height. The field used to be forced
              to `h-9` against a small button's `h-7`, and an explicit height
              defeats the row's stretch — so the button sat eight pixels short,
              hanging off the top of the field.
            */}
            <div className="flex items-center gap-2">
              <Input
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                /*
                 * Enter is what people press in a box beside an Add button.
                 * Left alone it would reach the task form and save the lot.
                 */
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  add();
                }}
                placeholder="Anna — Data"
                aria-label="Subtask title"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={add}
                disabled={pending || title.trim() === ""}
                className="shrink-0"
              >
                <Plus data-icon="inline-start" />
                {pending ? "Adding…" : "Add"}
              </Button>
            </div>
            {state?.error ? (
              <p role="alert" className="text-caption text-red-700">
                {state.error}
              </p>
            ) : null}
          </div>
        ) : null
      }
    />
  );
}
