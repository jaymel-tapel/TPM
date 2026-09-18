"use client";

import { useState } from "react";
import { Button } from "@tpm/ui/primitives/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@tpm/ui/primitives/dialog";
import { deleteTask } from "@/actions/tasks";

/**
 * Deleting is the only destructive action in the product and there is no undo,
 * so it asks first. A shared task is the case worth spelling out: the person
 * deleting removes it from everyone assigned, and may not be the only one who
 * cares about it.
 */
export function DeleteTaskButton({
  taskId,
  title,
  otherAssignees,
}: {
  taskId: string;
  title: string;
  /** Everyone assigned except the person doing the deleting. */
  otherAssignees: string[];
}) {
  const [pending, setPending] = useState(false);
  const shared = otherAssignees.length > 0;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-gray-600">
            Delete task
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this task?</DialogTitle>
          <DialogDescription>
            {shared ? (
              <>
                <span className="text-gray-1000">{title}</span> is shared with{" "}
                <span className="text-gray-1000">{otherAssignees.join(", ")}</span>. Deleting
                it removes it from their day too. This cannot be undone.
              </>
            ) : (
              <>
                <span className="text-gray-1000">{title}</span> will be removed. This cannot
                be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <form
            action={async (formData) => {
              setPending(true);
              await deleteTask(formData);
            }}
          >
            <input type="hidden" name="taskId" value={taskId} />
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting…" : shared ? "Delete for everyone" : "Delete task"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
