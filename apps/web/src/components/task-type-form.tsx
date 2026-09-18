"use client";

import { useState } from "react";
import { useActionState } from "react";
import { ButtonLink, TypeIcon, TYPE_ICON_NAMES, TYPE_TONE_NAMES, cn } from "@tpm/ui";
import { Button } from "@tpm/ui/primitives/button";
import { Input } from "@tpm/ui/primitives/input";
import { Label } from "@tpm/ui/primitives/label";
import type { FormState } from "@/actions/vocabulary";

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";

export type TaskTypeValues = {
  id?: string;
  name: string;
  icon: string;
  tone: string;
  position: number;
};

/**
 * A kind of work: what it is called, and the glyph and colour it wears.
 *
 * Both pickers are closed sets, and that is the point. The icon has to come
 * from a registry because a lucide component cannot be stored in a column, and
 * the colour has to come from a list because Tailwind only emits the classes it
 * can see written down — a hex out of a colour wheel would produce no CSS at
 * all. `DESIGN.md` records the six tones and why they are the only six.
 */
export function TaskTypeForm({
  action,
  values,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  values: TaskTypeValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [icon, setIcon] = useState(values.icon);
  const [tone, setTone] = useState(values.tone);
  const [name, setName] = useState(values.name);

  return (
    <form action={formAction} className="space-y-6">
      {values.id ? <input type="hidden" name="typeId" value={values.id} /> : null}
      {/* The pickers are buttons, not native controls, so what they chose has
          to be posted the way the task form posts its assignees and tags. */}
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="tone" value={tone} />

      <div className="space-y-6 rounded-xl border border-gray-400 bg-background-100 p-6">
        <div>
          <Label htmlFor="name" className={label}>
            Name
          </Label>
          <Input
            id="name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client Work"
            className="max-w-sm"
          />
          <p className="mt-2 text-caption text-gray-600">
            {values.id
              ? "Renaming is safe: filter links carry the type's original short name, which never changes."
              : "A short name is derived from this for filter links, and then stays put however the name changes."}
          </p>
        </div>

        <div>
          <span className={label}>Glyph</span>
          <div className="flex flex-wrap gap-1">
            {TYPE_ICON_NAMES.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option}
                aria-pressed={icon === option}
                onClick={() => setIcon(option)}
                className={cn(
                  "grid size-9 cursor-pointer place-items-center rounded-md border transition-colors",
                  icon === option
                    ? "border-blue-700 bg-blue-100"
                    : "border-gray-400 bg-background-100 hover:border-gray-500",
                )}
              >
                <TypeIcon type={{ slug: "", label: "", icon: option, tone }} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={label}>Tone</span>
          <div className="flex flex-wrap gap-1">
            {TYPE_TONE_NAMES.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option}
                aria-pressed={tone === option}
                onClick={() => setTone(option)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-body-strong capitalize transition-colors",
                  tone === option
                    ? "border-blue-700 bg-blue-100 text-blue-900"
                    : "border-gray-400 bg-background-100 text-gray-700 hover:border-gray-500",
                )}
              >
                <TypeIcon type={{ slug: "", label: "", icon, tone: option }} />
                {option}
              </button>
            ))}
          </div>
          <p className="mt-2 text-caption text-gray-600">
            Six tones and no more. Colour is rationed across the product, and a
            glyph is the one place a person chooses it rather than it meaning
            something.
          </p>
        </div>

        <div>
          <Label htmlFor="position" className={label}>
            Order
          </Label>
          <Input
            id="position"
            name="position"
            type="number"
            min={0}
            max={999}
            defaultValue={values.position}
            className="max-w-24"
          />
          <p className="mt-2 text-caption text-gray-600">
            Where it sits in every picker and filter. Lower comes first.
          </p>
        </div>

        {state?.error ? (
          <p className="rounded-md bg-red-100 px-3 py-2 text-body text-red-900">{state.error}</p>
        ) : null}

        <div className="flex items-center gap-4 border-t border-gray-300 pt-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
          <ButtonLink href="/admin/task-types" variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </div>
    </form>
  );
}
