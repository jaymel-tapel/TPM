"use client";

import { Plus } from "lucide-react";
import { SubtaskList, type SubtaskData } from "@tpm/ui";
import { Button } from "@tpm/ui/primitives/button";
import { Input } from "@tpm/ui/primitives/input";

/**
 * The gallery's copy of the creator the task form supplies. A field and a
 * button, never a form: the list renders inside the task form, and a nested
 * form is markup the browser discards.
 */
function Adder() {
  return (
    <div className="flex items-center gap-2">
      <Input placeholder="Add a step" aria-label="Subtask title" className="flex-1" />
      <Button type="button" className="shrink-0" disabled>
        <Plus data-icon="inline-start" />
        Add
      </Button>
    </div>
  );
}

/**
 * `addFor` is a function, and a function cannot be handed from a server
 * component to a client one — so the states that need it are assembled here,
 * the way `TaskBoardDemo` assembles the draggable board.
 */
export function SubtaskTreeDemo({ subtasks }: { subtasks: SubtaskData[] }) {
  return (
    <SubtaskList
      subtasks={subtasks}
      framed={false}
      onAdd={<Adder />}
      addFor={() => <Adder />}
      // Shallower than the product's five, so the floor is reachable here: the
      // deepest row in the fixture offers no way to nest further.
      maxDepth={2}
    />
  );
}

/** Nothing broken down yet — the state every task starts in. */
export function SubtaskEmptyDemo() {
  return <SubtaskList subtasks={[]} framed={false} onAdd={<Adder />} addFor={() => <Adder />} />;
}
