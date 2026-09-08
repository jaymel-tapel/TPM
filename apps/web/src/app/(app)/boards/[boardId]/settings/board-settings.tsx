"use client";

import { useActionState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@meridian/ui/primitives/button";
import { Input } from "@meridian/ui/primitives/input";
import { Label } from "@meridian/ui/primitives/label";
import { Panel, SectionHeader, StatusBadge, STATUS_KIND_LABELS, STATUS_KINDS } from "@meridian/ui";
import {
  addColumn,
  deleteColumn,
  moveColumn,
  renameBoard,
  updateColumn,
  type BoardFormState,
} from "@/actions/boards";
import type { BoardStatus } from "@/queries/boards";

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";

function Error({ state }: { state: BoardFormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="mt-2 text-caption text-red-700">
      {state.error}
    </p>
  );
}

/**
 * A native select rather than the design system's: the kind is the one field
 * on this page whose value the server enforces, and a plain control that
 * always submits its value is worth more here than a matching one.
 */
function KindSelect({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? "open"}
      className="h-8 rounded-md border border-gray-400 bg-background-100 px-2 text-body text-gray-1000"
    >
      {STATUS_KINDS.map((k) => (
        <option key={k} value={k}>
          {STATUS_KIND_LABELS[k]}
        </option>
      ))}
    </select>
  );
}

export function BoardSettings({
  boardId,
  boardName,
  columns,
}: {
  boardId: string;
  boardName: string;
  columns: BoardStatus[];
}) {
  const [renameState, rename] = useActionState(renameBoard, null);
  const [addState, add] = useActionState(addColumn, null);
  const [editState, edit] = useActionState(updateColumn, null);

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader>Board</SectionHeader>
        <Panel className="p-6">
          <form action={rename} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="boardId" value={boardId} />
            <div className="min-w-56 flex-1">
              <Label htmlFor="board-name" className={label}>
                Name
              </Label>
              <Input id="board-name" name="name" defaultValue={boardName} required />
            </div>
            <Button type="submit" variant="secondary">
              Rename
            </Button>
          </form>
          <Error state={renameState} />
        </Panel>
      </section>

      <section>
        <SectionHeader aside="Kind is what reports read; the name is what people read">
          Columns
        </SectionHeader>

        <Panel className="divide-y divide-gray-300">
          {columns.map((column, i) => (
            <div key={column.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="w-40 shrink-0">
                <StatusBadge status={column} />
              </div>

              <form action={edit} className="flex flex-1 flex-wrap items-center gap-2">
                <input type="hidden" name="statusId" value={column.id} />
                <Input
                  name="name"
                  defaultValue={column.name}
                  aria-label={`Rename ${column.name}`}
                  className="min-w-40 flex-1"
                />
                <KindSelect name="kind" defaultValue={column.kind} />
                <Button type="submit" variant="secondary" size="sm">
                  Save
                </Button>
              </form>

              <div className="flex items-center gap-1">
                <form action={moveColumn}>
                  <input type="hidden" name="statusId" value={column.id} />
                  <input type="hidden" name="direction" value="up" />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={i === 0}
                    aria-label={`Move ${column.name} earlier`}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                </form>
                <form action={moveColumn}>
                  <input type="hidden" name="statusId" value={column.id} />
                  <input type="hidden" name="direction" value="down" />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={i === columns.length - 1}
                    aria-label={`Move ${column.name} later`}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </form>
                <form action={deleteColumn}>
                  <input type="hidden" name="statusId" value={column.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${column.name}`}
                  >
                    <Trash2 className="size-4 text-red-700" />
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </Panel>
        <Error state={editState} />

        <Panel className="mt-4 p-4">
          <form action={add} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="boardId" value={boardId} />
            <div className="min-w-48 flex-1">
              <Label htmlFor="new-column" className={label}>
                New column
              </Label>
              <Input id="new-column" name="name" placeholder="For QA" required />
            </div>
            <div>
              <Label htmlFor="new-kind" className={label}>
                Counts as
              </Label>
              <KindSelect name="kind" />
            </div>
            <Button type="submit">
              <Plus className="size-4" />
              Add
            </Button>
          </form>
          <Error state={addState} />
          <p className="mt-3 max-w-prose text-caption text-gray-600">
            Columns are the stages work moves through, and you can have as many
            as the job needs. The one marked <em>Done</em> is the board&rsquo;s
            finish line: dropping a card there marks the task complete, whatever
            the column is called. Moving it onward, or back, leaves it complete
            — finishing is the task&rsquo;s own fact, and only marking it
            unfinished undoes it. Changing a kind decides what happens to cards
            dropped there next; it never rewrites work already done.
          </p>
        </Panel>
      </section>
    </div>
  );
}
