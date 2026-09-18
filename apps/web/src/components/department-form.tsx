"use client";

import { useActionState } from "react";
import { Button } from "@tpm/ui/primitives/button";
import { Label } from "@tpm/ui/primitives/label";
import { updateDepartment, type FormState } from "@/actions/admin";

function hourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function DepartmentForm({
  zones,
  timezone,
  startHour,
  endHour,
}: {
  zones: string[];
  timezone: string;
  startHour: number;
  endHour: number;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateDepartment,
    null,
  );

  const select =
    "h-9 w-full rounded-md border border-gray-400 bg-background-100 px-3 text-body text-gray-1000 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

  return (
    <form action={action} className="space-y-6">
      <div>
        <Label htmlFor="dept-timezone">Timezone</Label>
        <select
          id="dept-timezone"
          name="timezone"
          defaultValue={timezone}
          className={`${select} mt-2`}
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="dept-start">Day starts</Label>
          <select
            id="dept-start"
            name="startHour"
            defaultValue={String(startHour)}
            className={`${select} mt-2`}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="dept-end">Day ends</Label>
          <select
            id="dept-end"
            name="endHour"
            defaultValue={String(endHour)}
            className={`${select} mt-2`}
          >
            {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-caption text-gray-600">
        This is what anyone who has not set their own follows — change it and
        they move with it. It decides which tasks count as due today, what reads
        as overdue, and whether work was finished on time.
      </p>

      {state?.error ? (
        <p role="alert" className="text-caption text-red-700">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
