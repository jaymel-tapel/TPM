import { Avatar, AvatarFallback } from "../primitives/avatar";
import { cn } from "../lib/utils";

/**
 * Fill chosen deterministically from the name, drawn from the scales in
 * DESIGN.md. People in a list of fifteen should be recognisable at a glance,
 * not a column of identical rows.
 *
 * Solid with white initials, not a pale tint with dark ones. A tint at 24px
 * leaves the glyphs doing all the work of telling people apart, and it is the
 * glyphs that are hardest to read at that size; a filled disc is legible as a
 * colour before it is legible as letters. Every step here clears 5:1 against
 * white, which the lighter solids in each scale do not.
 */
const FILLS = [
  "bg-blue-900 text-white",
  "bg-amber-900 text-white",
  "bg-green-900 text-white",
  "bg-red-900 text-white",
  "bg-gray-800 text-white",
];

/**
 * FNV-1a with a final avalanche. A plain `hash * 31` does not work here: 31 is
 * congruent to 1 mod 5, so the multiply never reaches the low bits and every
 * name of similar length lands on the same tint.
 */
function fillFor(name: string) {
  let hash = 2166136261;
  for (const ch of name) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  return FILLS[(hash >>> 0) % FILLS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Sizes come off the 4pt grid: 16 / 24 / 32 / 40 / 64, each paired with its own
 * avatar step so the initials keep the same proportion at every size.
 *
 * Box and text are separate because they land on different elements. The
 * shadcn fallback sets `text-sm` on *itself*, so a font size on the root was
 * never inherited — every avatar drew 14px initials whatever its circle, which
 * is why the 16px and 24px ones spilled out of the ring and the larger ones
 * looked fine. Sizing the fallback directly is the only thing that reaches it.
 */
const SIZES = {
  xs: { box: "size-4", text: "text-avatar-xs" },
  sm: { box: "size-6", text: "text-avatar-sm" },
  md: { box: "size-8", text: "text-avatar-md" },
  lg: { box: "size-10", text: "text-avatar-lg" },
  xl: { box: "size-16", text: "text-avatar-xl" },
} as const;

export type AvatarSize = keyof typeof SIZES;

export function UserAvatar({
  name,
  size = "md",
  ring = false,
  className,
}: {
  name: string;
  size?: AvatarSize;
  /** A white ring, so overlapping avatars stay separable. */
  ring?: boolean;
  className?: string;
}) {
  return (
    <Avatar
      className={cn(SIZES[size].box, ring && "ring-2 ring-background-100", className)}
      title={name}
    >
      {/* `tracking-tight` because two wide capitals in a small disc need the
          pair kerned in, not the type shrunk further. */}
      <AvatarFallback className={cn(SIZES[size].text, "tracking-tight", fillFor(name))}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Overlapping stack for collaborative work, capped so it never sprawls. */
export function AvatarStack({
  names,
  size = "sm",
  max = 3,
  title,
}: {
  names: string[];
  size?: AvatarSize;
  max?: number;
  /** Hover text, since initials alone do not name anyone. */
  title?: string;
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;

  return (
    <span className="flex items-center -space-x-1" title={title}>
      {/*
        Position, not name. A thirty-person department can hold two people
        called the same thing, and keying by name would render one of them and
        drop the other. The list is a fixed, ordered slice that never reorders
        in place, which is exactly when an index is the honest key.
      */}
      {shown.map((name, i) => (
        <UserAvatar key={i} name={name} size={size} ring />
      ))}
      {extra > 0 ? (
        <span
          className={cn(
            // No initials, so it reads as a count rather than a person.
            "inline-grid place-items-center rounded-full bg-gray-600 text-white ring-2 ring-background-100",
            SIZES[size].box,
            SIZES[size].text,
          )}
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
