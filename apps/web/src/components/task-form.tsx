"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@meridian/ui/primitives/button";
import { Input } from "@meridian/ui/primitives/input";
import { Label } from "@meridian/ui/primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@meridian/ui/primitives/select";
import {
  ButtonLink,
  cn,
  PRIORITY_LABELS,
  StatusBadge,
  TASK_TYPE_LABELS,
  TypeLabel,
  UserAvatar,
  type Priority,
  type TaskType,
} from "@meridian/ui";
import { RichTextEditor } from "@meridian/ui/editor";
import { formatDuration, parseDuration } from "@/lib/duration";
import type { FormState } from "@/actions/tasks";
import { uploadAttachment } from "@/components/task-attachments";
import { LogTimeField } from "@/components/log-time-field";
import { useMentionSource } from "@/components/doc-mention";

export type AssignableUser = { id: string; name: string; team_name: string | null };
/** `teamId` is what decides who may be assigned or named on this board. */
export type BoardOption = { id: string; name: string; teamId: string };
export type StatusOption = { id: string; name: string; kind: "open" | "done" | "blocked" };

export type TaskFormValues = {
  id?: string;
  title: string;
  description: string;
  type: string;
  boardId: string;
  statusId: string;
  /** As typed — "2d 4h" — not minutes. The server parses it. */
  estimate: string;
  actual: string;
  priority: string;
  /** `datetime-local` string. */
  dueDate: string;
  assignees: string[];
  tags: string[];
};

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";

/** Echoes back what the server will understand, so nobody guesses. */
function durationHint(value: string): string {
  if (!value.trim()) return "e.g. 90m, 3h, 2d 4h, 1w";
  const minutes = parseDuration(value);
  return minutes === null ? "Not a duration" : `= ${formatDuration(minutes)}`;
}

/**
 * Screen 2, kept deliberately thin: the eight fields the brief lists and
 * nothing else. No custom fields, no status builder.
 */
export function TaskForm({
  action,
  values,
  peopleByBoard,
  allTags,
  submitLabel,
  boards,
  statusesByBoard,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  values: TaskFormValues;
  /**
   * Who may be assigned, per board id. Keyed like the columns are, and for the
   * same reason: a board's people are its team's people, and changing the
   * board changes both.
   */
  peopleByBoard: Record<string, AssignableUser[]>;
  allTags: string[];
  submitLabel: string;
  /** Boards the viewer may file work on. */
  boards: BoardOption[];
  /** Columns per board id — the status list changes with the board. */
  statusesByBoard: Record<string, StatusOption[]>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [selected, setSelected] = useState<string[]>(values.assignees);
  const [tags, setTags] = useState<string[]>(values.tags);
  const [search, setSearch] = useState("");
  const [type, setType] = useState(values.type);
  const [priority, setPriority] = useState(values.priority);
  const [boardId, setBoardId] = useState(values.boardId);
  /*
   * Still tracked, no longer shown. Status is set by the picker above the form
   * on an existing task, and a new one lands in its board's first column — but
   * the value still has to post, because that is what files the work.
   */
  const [statusId, setStatusId] = useState(values.statusId);
  const [estimate, setEstimate] = useState(values.estimate);
  // Named in a description, assigned in the sidebar — same board, so the
  // same set of people either way.
  const mentionSource = useMentionSource(boards.find((b) => b.id === boardId)?.teamId ?? null);

  const columns = statusesByBoard[boardId] ?? [];
  const people = peopleByBoard[boardId] ?? [];

  /*
   * Statuses belong to a board, so changing the board invalidates the chosen
   * column. Landing on the board's first column is the only safe default —
   * the server refuses a status that is not on the board anyway.
   */
  function chooseBoard(next: string) {
    setBoardId(next);
    /*
     * Assignees belong to the board's team, so moving the task to another
     * board drops anyone who does not come with it. Silently keeping them
     * would post a payload the server refuses, and the form would fail on a
     * field nobody had touched.
     */
    const allowed = new Set((peopleByBoard[next] ?? []).map((p) => p.id));
    setSelected((prev) => prev.filter((id) => allowed.has(id)));
    const first = statusesByBoard[next]?.[0];
    if (first) setStatusId(first.id);
  }

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
    const map = new Map<string, AssignableUser[]>();
    for (const p of matched) {
      const key = p.team_name ?? "Other";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [people, search]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <form
      action={formAction}
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start"
    >
      {values.id ? <input type="hidden" name="taskId" value={values.id} /> : null}
      {selected.map((id) => (
        <input key={id} type="hidden" name="assignees" value={id} />
      ))}
      {tags.map((t) => (
        <input key={t} type="hidden" name="tags" value={t} />
      ))}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="priority" value={priority} />
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="statusId" value={statusId} />

      <div className="space-y-6 rounded-xl border border-gray-400 bg-background-100 p-6">
        <div>
          <Label htmlFor="title" className={label}>
            Task title
          </Label>
          <Input
            id="title"
            name="title"
            required
            defaultValue={values.title}
            placeholder="What needs to happen?"
            className="text-subtitle-2"
          />
        </div>

        <div>
          <Label htmlFor="description" className={label}>
            Description
          </Label>
          {/*
            Files can only be attached to a task that exists — there is no id
            to hang them off until the first save — so the new-task form gets
            the editor without uploads and says so.
          */}
          <RichTextEditor
            name="description"
            defaultValue={values.description}
            mentionSource={mentionSource}
            uploadFile={
              values.id
                ? async (file) => (await uploadAttachment(values.id!, file)).href
                : undefined
            }
          />
          <p className="mt-2 text-caption text-gray-600">
            {values.id
              ? "Drop an image or file into the description to attach it. Type @ to reference a document."
              : "Type @ to reference a document. Save the task first to attach files."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="dueDate" className={label}>
              Due date
            </Label>
            <Input
              id="dueDate"
              name="dueDate"
              type="datetime-local"
              required
              defaultValue={values.dueDate}
            />
          </div>
          <div>
            <Label className={label}>Task type</Label>
            <Select value={type} onValueChange={(v) => v && setType(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v) => <TypeLabel type={v as TaskType} />}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    <TypeLabel type={t} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={label}>Priority</Label>
            <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v) => PRIORITY_LABELS[v as Priority]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={label}>Board</Label>
            <Select value={boardId} onValueChange={(v) => v && chooseBoard(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v) => boards.find((b) => b.id === v)?.name ?? "Pick a board"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {boards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/*
            Effort, not elapsed time: "1d" is a day's work. `lib/duration.ts`
            owns that convention and the server parses the same way, so what is
            echoed underneath is exactly what will be stored.
          */}
          <div>
            <Label htmlFor="estimate" className={label}>
              Estimated
            </Label>
            <Input
              id="estimate"
              name="estimate"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              placeholder="2d 4h"
              aria-describedby="estimate-hint"
            />
            <p id="estimate-hint" className="mt-1 text-caption text-gray-600">
              {durationHint(estimate)}
            </p>
          </div>
          {/*
            Not an input. Actual time is the sum of logged entries, each
            attributed and dated on the activity stream — the `+` adds one.
            Only on a task that exists: there is nothing to log against until
            it has an id.
          */}
          {values.id ? (
            <LogTimeField taskId={values.id} total={values.actual} />
          ) : (
            <div>
              <span className={label}>Actual</span>
              <p className="flex h-8 items-center text-body text-gray-600">—</p>
              <p className="mt-1 text-caption text-gray-600">
                Log time once the task exists
              </p>
            </div>
          )}
        </div>

        <div>
          <span className={label}>Tags</span>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const on = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setTags((prev) => (on ? prev.filter((t) => t !== tag) : [...prev, tag]))
                  }
                  className={cn(
                    "cursor-pointer rounded-md border px-2 py-1 text-body-strong transition-colors",
                    on
                      ? "border-blue-700 bg-blue-100 text-blue-900"
                      : "border-gray-400 bg-background-100 text-gray-700 hover:border-gray-500 hover:text-gray-1000",
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {state?.error ? (
          <p className="rounded-md bg-red-100 px-3 py-2 text-body text-red-900">{state.error}</p>
        ) : null}

        <div className="flex items-center gap-4 border-t border-gray-300 pt-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
          <ButtonLink href="/today" variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </div>

      <aside className="rounded-xl border border-gray-400 bg-background-100 p-6 lg:sticky lg:top-24">
        <span className={label}>Assignees</span>
        <p className="mb-3 text-caption text-gray-700">
          Pick more than one for shared work — completing it completes it for everyone.
        </p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people"
          className="mb-3"
        />
        <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
          {grouped.map(([team, members]) => (
            <div key={team}>
              <p className="mb-1.5 text-caption-strong uppercase tracking-[0.08em] text-gray-600">
                {team}
              </p>
              {members.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-body transition-colors",
                    selected.includes(p.id) ? "bg-blue-100" : "hover:bg-gray-100",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={() => toggle(p.id)}
                    className="size-4 accent-blue-700"
                  />
                  <UserAvatar name={p.name} size="sm" />
                  <span className="truncate text-gray-1000">{p.name}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        {selected.length > 1 ? (
          <p className="mt-4 rounded-md bg-blue-100 px-3 py-2 text-body-strong text-blue-900">
            Collaborative · {selected.length} people
          </p>
        ) : null}
      </aside>
    </form>
  );
}
