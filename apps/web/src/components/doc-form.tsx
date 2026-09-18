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
import { RichTextEditor } from "@tpm/ui/editor";
import type { FormState } from "@/actions/docs";
import { useMentionSource } from "@/components/doc-mention";

export type DocFormValues = {
  id?: string;
  title: string;
  body: string;
  visibility: "org" | "account";
  accountId: string;
  folderId: string;
};

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";

/** A document is a title and a body. Everything else is where it sits. */
export function DocForm({
  action,
  values,
  submitLabel,
  accounts,
  folders,
  canPublishOrgWide,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  values: DocFormValues;
  submitLabel: string;
  accounts: { id: string; name: string }[];
  /** Folders it may be filed in. */
  folders: { id: string; name: string }[];
  /** Only the Senior Director publishes to the whole department. */
  canPublishOrgWide: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [visibility, setVisibility] = useState(values.visibility);
  const [accountId, setAccountId] = useState(values.accountId);
  const [folderId, setFolderId] = useState(values.folderId);
  // An org-wide document is read by everyone, so everyone can be named in
  // one; an account's document is read by that account.
  const mentionSource = useMentionSource(visibility === "account" ? accountId : null);

  // Where a document sits decides who reads it, so a filed document takes its
  // parent's scope and the choice stops being a choice.
  const inFolder = folderId !== "";

  return (
    <form action={formAction} className="space-y-6">
      {values.id ? <input type="hidden" name="docId" value={values.id} /> : null}
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="accountId" value={visibility === "account" ? accountId : ""} />
      <input type="hidden" name="folderId" value={folderId} />

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
            <Label className={label}>Folder</Label>
            <Select value={folderId} onValueChange={(v) => setFolderId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v) => (v ? (folders.find((f) => f.id === v)?.name ?? "Docs") : "Docs")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Docs — not in a folder</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className={label}>Who can read it</Label>
            {inFolder ? (
              <p className="rounded-md bg-gray-100 px-3 py-2 text-body text-gray-700">
                Whoever can read the folder it is in.
              </p>
            ) : (
              <Select
                value={visibility}
                onValueChange={(v) => v && setVisibility(v as "org" | "account")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) => (v === "org" ? "Everyone" : "One account")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {canPublishOrgWide ? (
                    <SelectItem value="org">Everyone</SelectItem>
                  ) : null}
                  <SelectItem value="account">One account</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {!inFolder && visibility === "account" ? (
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
          <ButtonLink href={values.id ? `/docs/${values.id}` : "/docs"} variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </div>
    </form>
  );
}
