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
import { ButtonLink, ROLE_LABELS, type Role } from "@tpm/ui";
import type { FormState, NewPersonState } from "@/actions/admin";

export type PersonFormValues = {
  id?: string;
  name: string;
  email: string;
  role: Role;
  /** Their craft, in their own words. Optional — nobody has to have one. */
  title: string | null;
  /** Every account they work on. The set, not a choice among them. */
  accountIds: string[];
};

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";
const ROLES = Object.keys(ROLE_LABELS) as Role[];

export function PersonForm({
  action,
  values,
  submitLabel,
  accounts,
}: {
  action: (prev: never, formData: FormData) => Promise<FormState | NewPersonState>;
  values: PersonFormValues;
  submitLabel: string;
  accounts: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action as never, null as never);
  const [role, setRole] = useState<Role>(values.role);
  const [accountIds, setAccountIds] = useState<string[]>(values.accountIds);

  const toggle = (id: string) =>
    setAccountIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  // A Senior Director sits above the accounts, so there is no account to pick.
  const onAnAccount = role !== "senior_director";
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
      {/* One field per account, all under one name — which is how a form says
          "several" without a control that pretends there is only one. */}
      {onAnAccount
        ? accountIds.map((id) => (
            <input key={id} type="hidden" name="accountIds" value={id} />
          ))
        : null}

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
            <Label htmlFor="title" className={label}>
              Title
            </Label>
            <Input
              id="title"
              name="title"
              defaultValue={values.title ?? ""}
              placeholder="Designer"
            />
          </div>
        </div>

        <div>
          <Label className={label}>Accounts</Label>
          {onAnAccount ? (
            /*
             * Checkboxes, not a dropdown. A select answers "which one", and the
             * whole point of this screen now is that the answer is usually more
             * than one — a designer covering Volvo and MG is the ordinary
             * case, not the exception.
             */
            <div className="flex flex-wrap gap-2">
              {accounts.map((t) => {
                const on = accountIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    aria-pressed={on}
                    className={
                      on
                        ? "rounded-md bg-blue-100 px-3 py-2 text-body-strong text-blue-900"
                        : "rounded-md border border-gray-400 px-3 py-2 text-body text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-1000"
                    }
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-md bg-gray-100 px-3 py-2 text-body text-gray-700">
              Above the accounts, so on none.
            </p>
          )}
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
