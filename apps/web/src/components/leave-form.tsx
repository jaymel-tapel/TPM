"use client";

import { useActionState, useState } from "react";
import { Button } from "@meridian/ui/primitives/button";
import { Input } from "@meridian/ui/primitives/input";
import { Label } from "@meridian/ui/primitives/label";
import { Textarea } from "@meridian/ui/primitives/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@meridian/ui/primitives/select";
import { LEAVE_KIND_LABELS, LEAVE_KINDS, type LeaveKind } from "@meridian/ui";
import { fileLeave } from "@/actions/leave";

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * A summary of what is about to be filed.
 *
 * The dates are split and rebuilt rather than passed to `new Date(iso)`, which
 * parses a bare `yyyy-MM-dd` as UTC midnight and therefore renders as the
 * previous day for every reader west of it. That is the exact bug this
 * feature's `date` columns exist to avoid, and it would be a poor place to
 * reintroduce it.
 */
function summarise(startDate: string, endDate: string, half: string): string | null {
  if (!startDate || !endDate || endDate < startDate) return null;

  const say = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  };

  if (startDate === endDate) {
    if (half) return `${say(startDate)} · ${half === "am" ? "morning" : "afternoon"} only`;
    return say(startDate);
  }
  return `${say(startDate)} – ${say(endDate)}`;
}

/**
 * File for leave.
 *
 * There is no field for whose leave it is. The person filing is the person in
 * the session, and the action states that rule where it is enforced.
 */
export function LeaveForm() {
  const [state, formAction, pending] = useActionState(fileLeave, null);
  const [kind, setKind] = useState<LeaveKind>("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [half, setHalf] = useState("");

  // A half day is half of one day, so the choice only exists when there is one
  // day. Made unreachable here rather than merely refused later — the action
  // and the check constraint both still refuse it, for the payload that never
  // came through this form.
  const oneDay = Boolean(startDate) && startDate === endDate;
  const summary = summarise(startDate, endDate, oneDay ? half : "");

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="half" value={oneDay ? half : ""} />

      <div className="space-y-6 rounded-xl border border-gray-400 bg-background-100 p-6">
        <div>
          <Label className={label}>Kind</Label>
          <Select value={kind} onValueChange={(v) => v && setKind(v as LeaveKind)}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v) => LEAVE_KIND_LABELS[v as LeaveKind]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LEAVE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {LEAVE_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="startDate" className={label}>
              First day
            </Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              required
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                // A one-day request is the common case, so the end follows the
                // start until somebody moves it themselves.
                if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
              }}
            />
          </div>
          <div>
            <Label htmlFor="endDate" className={label}>
              Last day
            </Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              required
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {oneDay ? (
          <div>
            <Label className={label}>How much of the day</Label>
            <Select value={half} onValueChange={(v) => setHalf(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v) =>
                    v === "am" ? "Morning only" : v === "pm" ? "Afternoon only" : "Whole day"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Whole day</SelectItem>
                <SelectItem value="am">Morning only</SelectItem>
                <SelectItem value="pm">Afternoon only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div>
          <Label htmlFor="note" className={label}>
            Note for your director
          </Label>
          <Textarea id="note" name="note" rows={3} maxLength={500} />
          {/* Optional on purpose. People take leave; making them justify it is
              a policy this product has no business encoding. Only the filer
              and whoever decides it ever read this. */}
          <p className="mt-2 text-caption text-gray-600">
            Optional. Only you and your director see it.
          </p>
        </div>

        {summary ? (
          <p className="rounded-md bg-gray-100 px-3 py-2 text-body text-gray-800">{summary}</p>
        ) : null}
      </div>

      {state?.error ? (
        <p className="rounded-md bg-red-100 px-3 py-2 text-body text-red-900">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Filing…" : "File for leave"}
      </Button>
    </form>
  );
}
