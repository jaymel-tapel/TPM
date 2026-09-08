"use client";

import { useActionState, useState } from "react";
import { Button } from "@meridian/ui/primitives/button";
import { Input } from "@meridian/ui/primitives/input";
import { Label } from "@meridian/ui/primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@meridian/ui/primitives/select";
import { ButtonLink } from "@meridian/ui";
import { RichTextEditor } from "@meridian/ui/editor";
import type { FormState } from "@/actions/docs";
import { useMentionSource } from "@/components/doc-mention";

export type DocFormValues = {
  id?: string;
  title: string;
  body: string;
  visibility: "org" | "team";
  teamId: string;
  parentId: string;
};

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";

/** A document is a title and a body. Everything else is where it sits. */
export function DocForm({
  action,
  values,
  submitLabel,
  teams,
  parents,
  canPublishOrgWide,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  values: DocFormValues;
  submitLabel: string;
  teams: { id: string; name: string }[];
  /** Documents this one may be filed under. Never its own subtree. */
  parents: { id: string; title: string }[];
  /** Only the Senior Director publishes to the whole department. */
  canPublishOrgWide: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [visibility, setVisibility] = useState(values.visibility);
  const [teamId, setTeamId] = useState(values.teamId);
  const [parentId, setParentId] = useState(values.parentId);
  // An org-wide document is read by everyone, so everyone can be named in
  // one; a team's document is read by that team.
  const mentionSource = useMentionSource(visibility === "team" ? teamId : null);

  // Where a document sits decides who reads it, so a filed document takes its
  // parent's scope and the choice stops being a choice.
  const nested = parentId !== "";

  return (
    <form action={formAction} className="space-y-6">
      {values.id ? <input type="hidden" name="docId" value={values.id} /> : null}
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="teamId" value={visibility === "team" ? teamId : ""} />
      <input type="hidden" name="parentId" value={parentId} />

      <div className="space-y-6 rounded-xl border border-gray-400 bg-background-100 p-6">
        <div>
          <Label htmlFor="title" className={label}>
            Title
          </Label>
          <Input
            id="title"
            name="title"
            required
            defaultValue={values.title}
            placeholder="What is this document?"
            className="text-subtitle-2"
          />
        </div>

        <div>
          <Label htmlFor="body" className={label}>
            Body
          </Label>
          <RichTextEditor
            name="body"
            defaultValue={values.body}
            placeholder="Write it down once."
            mentionSource={mentionSource}
          />
          <p className="mt-2 text-caption text-gray-600">
            Type <code>@</code> to reference another document.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className={label}>Filed under</Label>
            <Select value={parentId} onValueChange={(v) => setParentId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v) =>
                    v ? (parents.find((p) => p.id === v)?.title ?? "Nothing") : "Nothing"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nothing — a top-level document</SelectItem>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className={label}>Who can read it</Label>
            {nested ? (
              <p className="rounded-md bg-gray-100 px-3 py-2 text-body text-gray-700">
                Whoever can read the document it is filed under.
              </p>
            ) : (
              <Select
                value={visibility}
                onValueChange={(v) => v && setVisibility(v as "org" | "team")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) => (v === "org" ? "Everyone" : "One team")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {canPublishOrgWide ? (
                    <SelectItem value="org">Everyone</SelectItem>
                  ) : null}
                  <SelectItem value="team">One team</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {!nested && visibility === "team" ? (
            <div>
              <Label className={label}>Team</Label>
              <Select value={teamId} onValueChange={(v) => v && setTeamId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) => teams.find((t) => t.id === v)?.name ?? "Pick a team"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {state?.error ? (
          <p className="rounded-md bg-red-100 px-3 py-2 text-body text-red-900">{state.error}</p>
        ) : null}

        <div className="flex items-center gap-4 border-t border-gray-300 pt-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
          <ButtonLink href={values.id ? `/docs/${values.id}` : "/docs"} variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </div>
    </form>
  );
}
