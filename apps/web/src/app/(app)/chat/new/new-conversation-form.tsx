"use client";

import { useActionState, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@meridian/ui/primitives/button";
import { Input } from "@meridian/ui/primitives/input";
import { Label } from "@meridian/ui/primitives/label";
import { ButtonLink, Panel, UserAvatar } from "@meridian/ui";
import { startConversation, type ChatState } from "@/actions/chat";

type Person = { id: string; name: string; accountName: string | null };

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";

/**
 * One picker for everybody in the department.
 *
 * No mode to choose first: how many people you pick is what decides whether
 * this is a conversation with somebody or a group, and asking that up front
 * made people answer a question about our data model before they could answer
 * the one they came with — who do I want to talk to.
 */
export function NewConversationForm({ people }: { people: Person[] }) {
  const [state, action, pending] = useActionState<ChatState, FormData>(
    startConversation,
    null,
  );
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? people.filter((p) => p.name.toLowerCase().includes(needle))
    : people;

  const chosen = people.filter((p) => picked.includes(p.id));
  const group = picked.length > 1;

  const toggle = (id: string) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Panel className="flex h-full min-h-0 flex-col p-6">
      <form action={action} className="flex h-full min-h-0 flex-col gap-4">
        {picked.map((id) => (
          <input key={id} type="hidden" name="members" value={id} />
        ))}

        <div className="flex min-h-0 flex-1 flex-col">
          <span className={label}>Who</span>

          {/* What has been picked, in front of the list rather than buried in
              it: with thirty people the ticks scroll out of sight. */}
          {chosen.length > 0 ? (
            <ul className="mb-3 flex shrink-0 flex-wrap gap-2">
              {chosen.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => toggle(person.id)}
                    aria-label={`Remove ${person.name}`}
                    className="flex items-center gap-2 rounded-full bg-blue-100 py-1 pl-1 pr-2 text-body text-blue-1000 transition-colors hover:bg-blue-200"
                  >
                    <UserAvatar name={person.name} size="sm" />
                    {person.name}
                    <X className="size-3.5" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="relative shrink-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-600"
              strokeWidth={1.75}
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              className="pl-9"
            />
          </div>

          <ul className="mt-2 min-h-0 flex-1 overflow-y-auto">
            {shown.map((person) => {
              const on = picked.includes(person.id);
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => toggle(person.id)}
                    aria-pressed={on}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-100"
                  >
                    <UserAvatar name={person.name} size="md" />
                    <span className="min-w-0 flex-1 truncate text-body text-gray-1000">
                      {person.name}
                    </span>
                    {/* The tick is the state; the row is the control. */}
                    <span
                      aria-hidden
                      className={
                        on
                          ? "grid size-5 shrink-0 place-items-center rounded-full bg-blue-700 text-caption-strong text-white"
                          : "size-5 shrink-0 rounded-full border border-gray-400"
                      }
                    >
                      {on ? "✓" : null}
                    </span>
                  </button>
                </li>
              );
            })}
            {shown.length === 0 ? (
              <li className="px-2 py-6 text-center text-caption text-gray-600">
                Nobody matches that.
              </li>
            ) : null}
          </ul>
        </div>

        {/* Only once it is a group: naming a conversation with one person is a
            question nobody has an answer to. */}
        {group ? (
          <div className="shrink-0">
            <Label htmlFor="name" className={label}>
              Group name <span className="normal-case tracking-normal">(optional)</span>
            </Label>
            <Input id="name" name="name" placeholder="Northline launch" />
            <p className="mt-2 text-caption text-gray-600">
              Leave it blank and the group is named by who is in it.
            </p>
          </div>
        ) : null}

        {state?.error ? (
          <p role="alert" className="text-caption text-red-700">
            {state.error}
          </p>
        ) : null}

        <div className="flex shrink-0 items-center gap-3 border-t border-gray-300 pt-4">
          <Button type="submit" disabled={pending || picked.length === 0}>
            {pending
              ? "Opening…"
              : group
                ? "Create group chat"
                : "Start conversation"}
          </Button>
          <ButtonLink href="/chat" variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </Panel>
  );
}
