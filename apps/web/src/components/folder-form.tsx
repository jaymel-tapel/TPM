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
import type { FormState } from "@/actions/docs";

export type FolderFormValues = {
  id?: string;
  name: string;
  visibility: "org" | "account";
  accountId: string;
  parentId: string;
};

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";

/** A folder is a name and a place. It holds documents; it does not hold text. */
export function FolderForm({
  action,
  values,
  submitLabel,
  accounts,
  parents,
  canPublishOrgWide,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  values: FolderFormValues;
  submitLabel: string;
  accounts: { id: string; name: string }[];
  /** Folders this one may sit in. Never its own subtree. */
  parents: { id: string; name: string }[];
  canPublishOrgWide: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [visibility, setVisibility] = useState(values.visibility);
  const [accountId, setAccountId] = useState(values.accountId);
  const [parentId, setParentId] = useState(values.parentId);

  // A folder inside another takes its place from it, so the choice stops being
  // a choice — same rule as a document filed in a folder.
  const nested = parentId !== "";

  return (
    <form action={formAction} className="space-y-6">
      {values.id ? <input type="hidden" name="folderId" value={values.id} /> : null}
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="accountId" value={visibility === "account" ? accountId : ""} />
      <input type="hidden" name="parentId" value={parentId} />

      <div className="space-y-6 rounded-xl border border-gray-400 bg-background-100 p-6">
        <div>
          <Label htmlFor="name" className={label}>
            Folder name
          </Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={values.name}
            placeholder="What goes in here?"
            className="text-subtitle-2"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className={label}>Inside</Label>
            <Select value={parentId} onValueChange={(v) => setParentId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v) => (v ? (parents.find((p) => p.id === v)?.name ?? "Docs") : "Docs")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Docs — a top-level folder</SelectItem>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className={label}>Who can read it</Label>
            {nested ? (
              <p className="rounded-md bg-gray-100 px-3 py-2 text-body text-gray-700">
                Whoever can read the folder it is in.
              </p>
            ) : (
              <Select
                value={visibility}
                onValueChange={(v) => v && setVisibility(v as "org" | "account")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{(v) => (v === "org" ? "Everyone" : "One account")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {canPublishOrgWide ? <SelectItem value="org">Everyone</SelectItem> : null}
                  <SelectItem value="account">One account</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {!nested && visibility === "account" ? (
            <div>
              <Label className={label}>Account</Label>
              <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) => accounts.find((t) => t.id === v)?.name ?? "Pick an account"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((t) => (
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
          <ButtonLink href={values.id ? `/docs/folders/${values.id}` : "/docs"} variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </div>
    </form>
  );
}
