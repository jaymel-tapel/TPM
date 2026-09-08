import { Avatar, AvatarFallback } from "../primitives/avatar";
import { cn } from "../lib/utils";

/**
 * Tint chosen deterministically from the name, drawn from the scales in
 * DESIGN.md. People in a list of fifteen should be recognisable at a glance,
 * not a column of identical rows.
 */
const TINTS = [
  "bg-blue-200 text-blue-1000",
  "bg-amber-200 text-amber-1000",
  "bg-green-200 text-green-1000",
  "bg-red-200 text-red-1000",
  "bg-gray-200 text-gray-1000",
];

/**
 * FNV-1a with a final avalanche. A plain `hash * 31` does not work here: 31 is
 * congruent to 1 mod 5, so the multiply never reaches the low bits and every
 * name of similar length lands on the same tint.
 */
function tintFor(name: string) {
  let hash = 2166136261;
  for (const ch of name) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  return TINTS[(hash >>> 0) % TINTS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Sizes come off the 4pt grid: 16 / 24 / 32 / 40 / 64. */
const SIZES = {
  xs: "size-4 text-avatar-xs",
  sm: "size-6 text-avatar-sm",
  md: "size-8 text-label-12",
  lg: "size-10 text-label-14",
  xl: "size-16 text-label-20",
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
      className={cn(SIZES[size], ring && "ring-2 ring-background-100", className)}
      title={name}
    >
      <AvatarFallback className={cn("font-medium", tintFor(name))}>
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
      {shown.map((name) => (
        <UserAvatar key={name} name={name} size={size} ring />
      ))}
      {extra > 0 ? (
        <span
          className={cn(
            "inline-grid place-items-center rounded-full bg-gray-200 font-medium text-gray-700 ring-2 ring-background-100",
            SIZES[size],
          )}
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
