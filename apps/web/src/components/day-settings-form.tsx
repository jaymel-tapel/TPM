"use client";

import { useActionState } from "react";
import { Button } from "@tpm/ui/primitives/button";
import { Label } from "@tpm/ui/primitives/label";
import { updateDaySettings, type SettingsState } from "@/actions/settings";

/** "9 AM", "12 PM", "11 PM" — the labels the grid's gutter uses. */
function hourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour === 24) return "12 AM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function DaySettingsForm({
  zones,
  timezone,
  departmentZone,
  startHour,
  endHour,
  defaultStartHour,
  defaultEndHour,
}: {
  zones: string[];
  timezone: string;
  departmentZone: string;
  startHour: number;
  endHour: number;
  defaultStartHour: number;
  defaultEndHour: number;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateDaySettings,
    null,
  );

  const starts = Array.from({ length: 24 }, (_, i) => i);
  const ends = Array.from({ length: 24 }, (_, i) => i + 1);

  const select =
    "h-9 w-full rounded-md border border-gray-400 bg-background-100 px-3 text-body text-gray-1000 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

  return (
    <form action={action} className="space-y-6">
      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <select id="timezone" name="timezone" defaultValue={timezone} className={`${select} mt-2`}>
          {/* Empty is not blank — it means "whatever the department uses",
              so this person follows the default if it ever moves. */}
          <option value="">Follow the department ({departmentZone})</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="startHour">Day starts</Label>
          <select
            id="startHour"
            name="startHour"
            defaultValue={String(startHour)}
            className={`${select} mt-2`}
          >
            {starts.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="endHour">Day ends</Label>
          <select
            id="endHour"
            name="endHour"
            defaultValue={String(endHour)}
            className={`${select} mt-2`}
          >
            {ends.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-caption text-gray-600">
        The plan still shows anything you put outside these hours — they decide
        where the grid opens, not what it will hold. The department&rsquo;s day is{" "}
        {hourLabel(defaultStartHour)} to {hourLabel(defaultEndHour)}.
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
