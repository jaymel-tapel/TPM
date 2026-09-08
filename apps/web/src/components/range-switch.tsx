import { CalendarCheck, CalendarDays } from "lucide-react";
import { Command, CommandBar } from "@meridian/ui";
import type { TeamRange } from "@/lib/range";

/**
 * Today, or the week behind it.
 *
 * A link rather than client state, the way the board's list/columns switch is:
 * the window is in the URL, so it survives a reload and can be sent to
 * somebody. Two commands is the whole control — a date picker here would be
 * the report's job arriving on the wrong screen.
 */
export function RangeSwitch({
  range,
  basePath,
  className,
}: {
  range: TeamRange;
  /** The route the two links point back at, without a query string. */
  basePath: string;
  className?: string;
}) {
  return (
    <CommandBar className={className}>
      <Command icon={CalendarCheck} href={basePath} active={range === "day"}>
        Day
      </Command>
      <Command icon={CalendarDays} href={`${basePath}?range=week`} active={range === "week"}>
        Week
      </Command>
    </CommandBar>
  );
}
