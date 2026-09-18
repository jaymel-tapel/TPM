"use client";

import { useActionState, useState } from "react";
import { Button } from "@tpm/ui/primitives/button";
import { Input } from "@tpm/ui/primitives/input";
import { Label } from "@tpm/ui/primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tpm/ui/primitives/select";
import { ButtonLink } from "@tpm/ui";
import type { FormState } from "@/actions/admin";

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";

export function AccountAdminForm({
  action,
  values,
  submitLabel,
  directors,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  values: { id?: string; name: string; accountDirectorId: string };
  submitLabel: string;
  /** Account Directors already on this account — the only people eligible. */
  directors: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [directorId, setDirectorId] = useState(values.accountDirectorId);

  return (
    <form action={formAction} className="space-y-6">
      {values.id ? <input type="hidden" name="accountId" value={values.id} /> : null}
      <input type="hidden" name="accountDirectorId" value={directorId} />

      <div className="space-y-6 rounded-xl border border-gray-400 bg-background-100 p-6">
        <div>
          <Label htmlFor="name" className={label}>
            Account name
          </Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={values.name}
            className="text-subtitle-2"
          />
        </div>

        {values.id ? (
          <div className="max-w-sm">
            <Label className={label}>Account Director</Label>
            {directors.length > 0 ? (
              <Select value={directorId} onValueChange={(v) => setDirectorId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) =>
                      v ? (directors.find((d) => d.id === v)?.name ?? "Nobody") : "Nobody"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nobody</SelectItem>
                  {directors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="rounded-md bg-gray-100 px-3 py-2 text-body text-gray-700">
                Nobody on this account is an Account Director yet. Make someone one first.
              </p>
            )}
          </div>
        ) : (
          <p className="text-caption text-gray-600">
            A director is chosen once there is somebody on the account to be one.
          </p>
        )}

        {state?.error ? (
          <p className="rounded-md bg-red-100 px-3 py-2 text-body text-red-900">{state.error}</p>
        ) : null}

        <div className="flex items-center gap-4 border-t border-gray-300 pt-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
          <ButtonLink href="/admin" variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </div>
    </form>
  );
}
