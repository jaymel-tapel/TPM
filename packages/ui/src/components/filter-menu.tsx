import Link from "next/link";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "../lib/utils";
import { commandStyles, commandTone } from "./command-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";

export type FilterOption = {
  value: string;
  /** How the option reads in the menu — a glyph and a word, like the cards. */
  label: React.ReactNode;
  /** The same thing in plain words, for the trigger and for a screen reader. */
  short: string;
  href: string;
};

/**
 * One dimension of a filter: a name, what you can narrow it to, and where each
 * choice goes.
 *
 * It narrows a view rather than switching between views, so it sits in the
 * command bar and is shaped like a `Command` — the same height, the same
 * padding, the same blue when it is doing something. What it is not is a form
 * control: every option is a link, the page it lands on is the answer, and a
 * narrowed board is therefore something you can send to somebody.
 *
 * It knows nothing about boards, columns or query strings. The page builds
 * every href, which is what lets the same menu serve the board today and the
 * team view when that gets filters of its own.
 */
export function FilterMenu({
  label,
  icon: Icon,
  options,
  value,
  clearHref,
  empty = "Nothing to filter by",
}: {
  /** The dimension: "Type", "Priority", "Tag". */
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  options: FilterOption[];
  /** The chosen value, if any. */
  value?: string;
  /** Where the ✕ goes. Required, because an inescapable filter is a trap. */
  clearHref: string;
  /** Said in the menu when there is nothing to offer, rather than opening empty. */
  empty?: string;
}) {
  const active = options.find((option) => option.value === value);

  return (
    <span className="inline-flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            commandStyles,
            commandTone("default", Boolean(active)),
            // Joined to the clear button, so the pair reads as one control.
            active && "rounded-r-none",
          )}
        >
          <Icon className="size-4 shrink-0" strokeWidth={1.75} />
          {/* The dimension stays on the trigger even when a value is chosen:
              three of these side by side, each showing only its value, would
              be three words with nothing to say which question they answer. */}
          {label}
          {active ? (
            <>
              <span aria-hidden className="text-blue-700">
                ·
              </span>
              {active.short}
            </>
          ) : null}
          <ChevronDown
            aria-hidden
            className={cn("size-3.5 shrink-0", active ? "text-blue-700" : "text-gray-600")}
            strokeWidth={1.75}
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          {options.length === 0 ? (
            <p className="px-2 py-2 text-caption text-gray-600">{empty}</p>
          ) : (
            options.map((option) => (
              <DropdownMenuItem
                key={option.value}
                render={<Link href={option.href} />}
                className="gap-2 px-2 py-1.5 text-body text-gray-1000"
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.value === value ? (
                  <Check aria-hidden className="size-4 shrink-0 text-blue-700" strokeWidth={2.25} />
                ) : null}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {active ? (
        <Link
          href={clearHref}
          aria-label={`Clear the ${label.toLowerCase()} filter`}
          className="-ml-px inline-flex items-center rounded-r-md bg-blue-100 py-1.5 pr-2 pl-1 text-blue-900 transition-colors hover:bg-blue-200"
        >
          <X aria-hidden className="size-3.5" strokeWidth={2} />
        </Link>
      ) : null}
    </span>
  );
}
