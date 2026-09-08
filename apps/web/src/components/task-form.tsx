"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@meridian/ui/primitives/button";
import { Input } from "@meridian/ui/primitives/input";
import { Label } from "@meridian/ui/primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@meridian/ui/primitives/select";
import { Textarea } from "@meridian/ui/primitives/textarea";
import {
  ButtonLink,
  cn,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_TYPE_LABELS,
  TypeLabel,
  UserAvatar,
  type Priority,
  type TaskStatus,
  type TaskType,
} from "@meridian/ui";
import type { FormState } from "@/actions/tasks";

export type AssignableUser = { id: string; name: string; team_name: string | null };

export type TaskFormValues = {
  id?: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  /** `datetime-local` string. */
  dueDate: string;
  assignees: string[];
  tags: string[];
};

const label = "mb-2 block text-label-12 uppercase tracking-[0.08em] text-gray-600";

/**
 * Screen 2, kept deliberately thin: the eight fields the brief lists and
 * nothing else. No custom fields, no status builder.
 */
export function TaskForm({
  action,
  values,
  people,
  allTags,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  values: TaskFormValues;
  people: AssignableUser[];
  allTags: string[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [selected, setSelected] = useState<string[]>(values.assignees);
  const [tags, setTags] = useState<string[]>(values.tags);
  const [search, setSearch] = useState("");
  const [type, setType] = useState(values.type);
  const [priority, setPriority] = useState(values.priority);
  const [status, setStatus] = useState(values.status);

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
      <input type="hidden" name="status" value={status} />

      <div className="space-y-6 rounded-12 border border-gray-400 bg-background-100 p-6">
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
            className="text-label-16"
          />
        </div>

        <div>
          <Label htmlFor="description" className={label}>
            Description
          </Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={values.description}
            placeholder="Optional context"
          />
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
            <Label className={label}>Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v) => STATUS_LABELS[v as TaskStatus]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                    "cursor-pointer rounded-6 border px-2 py-1 text-label-14 transition-colors",
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
          <p className="rounded-6 bg-red-100 px-3 py-2 text-copy-14 text-red-900">{state.error}</p>
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

      <aside className="rounded-12 border border-gray-400 bg-background-100 p-6 lg:sticky lg:top-24">
        <span className={label}>Assignees</span>
        <p className="mb-3 text-copy-13 text-gray-700">
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
              <p className="mb-1.5 text-label-12 uppercase tracking-[0.08em] text-gray-600">
                {team}
              </p>
              {members.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-6 px-2 py-1.5 text-copy-14 transition-colors",
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
          <p className="mt-4 rounded-6 bg-blue-100 px-3 py-2 text-label-14 text-blue-900">
            Collaborative · {selected.length} people
          </p>
        ) : null}
      </aside>
    </form>
  );
}
