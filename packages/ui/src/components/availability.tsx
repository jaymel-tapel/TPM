import { CalendarOff } from "lucide-react";
import { LEAVE_KIND_LABELS, type AvailabilityData } from "../types";

/**
 * The away marker.
 *
 * Grey, and deliberately. Red reports a problem and a booked holiday is not
 * one; amber is reserved by DESIGN.md for the single most important number on
 * a screen. Being off is a state rather than an exception, so the word carries
 * the meaning and the colour only steps out of the way.
 *
 * Geometry is the role badge's, so the two sit level on the same line. It says
 * *why* somebody is out; the note beneath the name says *when* they are back,
 * and neither repeats the other.
 */
export function AwayBadge({ away }: { away: AvailabilityData }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-gray-200 px-1.5 text-caption-strong text-gray-800"
      title={away.label}
    >
      <CalendarOff aria-hidden className="size-3" strokeWidth={1.75} />
      {LEAVE_KIND_LABELS[away.kind]}
    </span>
  );
}
