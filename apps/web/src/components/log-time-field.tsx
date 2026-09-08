"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { Input } from "@meridian/ui/primitives/input";
import { logTime } from "@/actions/activity";

/**
 * The Actual field: a total you read, and a `+` that opens a box to add to it.
 *
 * Actual time is logged rather than typed — the total is the sum of entries on
 * the task's activity, each attributed and dated, not a number somebody
 * overwrites. But the place to record it is the place you read it, so the
 * control lives here rather than down in the feed.
 *
 * The input replaces the total in place and hands it back on save or cancel,
 * so the field never grows a second row and the layout does not move.
 *
 * It calls the action directly rather than submitting: this sits inside the
 * task form, and a form inside a form is not valid HTML — the browser drops
 * the inner one and Save would post the wrong thing.
 */
export function LogTimeField({ taskId, total }: { taskId: string; total: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function close() {
    setOpen(false);
    setValue("");
    setError(null);
  }

  async function save() {
    if (!value.trim() || pending) return;
    setPending(true);
    const formData = new FormData();
    formData.set("taskId", taskId);
    formData.set("spent", value);

    const result = await logTime(null, formData);
    setPending(false);

    if (result?.error) {
      // Keep what was typed: the amount is the whole content of the field.
      setError(result.error);
      input.current?.focus();
      return;
    }
    close();
    router.refresh();
  }

  if (!open) {
    return (
      <div>
        <span className="mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600">
          Actual
        </span>
        <div className="flex h-8 items-center gap-2">
          <span className="tabular text-body text-gray-1000">{total || "—"}</span>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              // The field is the only thing here; land in it.
              requestAnimationFrame(() => input.current?.focus());
            }}
            aria-label="Log time"
            className="rounded-md p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-1000"
          >
            <Plus className="size-4" strokeWidth={2} />
          </button>
        </div>
        <p className="mt-1 text-caption text-gray-600">
          {total ? "Logged, entry by entry" : "Nothing logged yet"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <span className="mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600">
        Log time
      </span>
      <div className="flex h-8 items-center gap-1">
        <Input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Enter must not reach the task form, or logging time would save
            // the whole task as a side effect.
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
          placeholder="2h 30m"
          aria-label="Time to log"
          className="h-8 flex-1"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={!value.trim() || pending}
          aria-label="Save this entry"
          className="rounded-md p-1 text-green-700 transition-colors hover:bg-green-100 disabled:text-gray-500"
        >
          <Check className="size-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="Cancel"
          className="rounded-md p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-1000"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>
      <p className={`mt-1 text-caption ${error ? "text-red-700" : "text-gray-600"}`}>
        {error ?? `Adds to ${total || "nothing logged"}`}
      </p>
    </div>
  );
}
