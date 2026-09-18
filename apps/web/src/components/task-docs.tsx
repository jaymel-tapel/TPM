"use client";

import { useState } from "react";
import { DocRefList } from "@tpm/ui";
import type { DocRefData } from "@tpm/ui";
import { attachDocToTask, detachDocFromTask } from "@/actions/docs";
import { useMentionSource } from "@/components/doc-mention";

/**
 * The documents a task points at, plus the control that attaches one.
 *
 * The picker reuses the `@` index — the same list, scoped the same way, fetched
 * once. Two ways to make the same link should not be two ways of deciding what
 * may be linked. It filters to documents, because that index also carries
 * people now and a person is not something a task attaches.
 */
export function TaskDocs({
  taskId,
  docs,
  editable,
}: {
  taskId: string;
  docs: DocRefData[];
  editable: boolean;
}) {
  const [options, setOptions] = useState<{ id: string; title: string }[] | null>(null);
  const source = useMentionSource();
  const linked = new Set(docs.map((d) => d.id));

  return (
    <DocRefList
      docs={docs}
      onDetach={
        editable
          ? async (formData) => {
              formData.set("taskId", taskId);
              await detachDocFromTask(formData);
            }
          : undefined
      }
      onAdd={
        editable ? (
          <div className="flex items-center gap-2">
            {options ? (
              <select
                autoFocus
                defaultValue=""
                onChange={async (e) => {
                  const documentId = e.target.value;
                  if (!documentId) return;
                  const formData = new FormData();
                  formData.set("taskId", taskId);
                  formData.set("documentId", documentId);
                  await attachDocToTask(formData);
                  setOptions(null);
                }}
                className="rounded-md border border-gray-400 bg-background-100 px-2 py-1 text-body text-gray-1000"
              >
                <option value="">Pick a document…</option>
                {options
                  .filter((o) => !linked.has(o.id))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
              </select>
            ) : (
              <button
                type="button"
                // Documents only. The `@` index now carries people too, and
                // a person is not something a task can attach.
                onClick={async () =>
                  setOptions((await source("")).filter((item) => item.kind === "doc"))
                }
                className="rounded-md px-2 py-1 text-caption-strong text-blue-700 transition-colors hover:bg-blue-100"
              >
                Attach a document
              </button>
            )}
          </div>
        ) : null
      }
    />
  );
}
