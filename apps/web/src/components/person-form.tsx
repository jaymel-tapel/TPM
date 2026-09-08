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
import { ButtonLink, ROLE_LABELS, type Role } from "@meridian/ui";
import type { FormState, NewPersonState } from "@/actions/admin";

export type PersonFormValues = {
  id?: string;
  name: string;
  email: string;
  role: Role;
  teamId: string;
};

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";
const ROLES = Object.keys(ROLE_LABELS) as Role[];

export function PersonForm({
  action,
  values,
  submitLabel,
  teams,
}: {
  action: (prev: never, formData: FormData) => Promise<FormState | NewPersonState>;
  values: PersonFormValues;
  submitLabel: string;
  teams: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action as never, null as never);
  const [role, setRole] = useState<Role>(values.role);
  const [teamId, setTeamId] = useState(values.teamId);

  // A Senior Director sits above the teams, so there is no team to pick.
  const onATeam = role !== "senior_director";
  const result = state as NewPersonState;

  if (result?.created) {
    return (
      <div className="space-y-6 rounded-xl border border-gray-400 bg-background-100 p-6">
        <div>
          <h2 className="text-subtitle-1 text-gray-1000">{result.created.name} is set up</h2>
          <p className="mt-2 text-body text-gray-700">
            Hand them this password. It is shown once and is not stored anywhere it can be
            read back — if it is lost, set a new one.
          </p>
        </div>
        <p className="rounded-md border border-gray-400 bg-gray-100 px-3 py-2 font-mono text-body-lg text-gray-1000 select-all">
          {result.created.password}
        </p>
        <div className="flex items-center gap-4 border-t border-gray-300 pt-4">
          <ButtonLink href="/admin">Back to admin</ButtonLink>
          <ButtonLink href="/admin/people/new" variant="ghost">
            Add another
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {values.id ? <input type="hidden" name="userId" value={values.id} /> : null}
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="teamId" value={onATeam ? teamId : ""} />

      <div className="space-y-6 rounded-xl border border-gray-400 bg-background-100 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name" className={label}>
              Name
            </Label>
            <Input id="name" name="name" required defaultValue={values.name} />
          </div>
          <div>
            <Label htmlFor="email" className={label}>
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={values.email}
              placeholder="name@demo.co"
            />
          </div>

          <div>
            <Label className={label}>Role</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v as Role)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v) => ROLE_LABELS[v as Role]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className={label}>Team</Label>
            {onATeam ? (
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
            ) : (
              <p className="rounded-md bg-gray-100 px-3 py-2 text-body text-gray-700">
                Above the teams, so on none.
              </p>
            )}
          </div>
        </div>

        {result?.error ? (
          <p className="rounded-md bg-red-100 px-3 py-2 text-body text-red-900">{result.error}</p>
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
