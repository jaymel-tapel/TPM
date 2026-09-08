import { createCn } from "cn/config";

/**
 * The type steps this system defines, by name.
 *
 * These have to be declared to the class merger, not just to Tailwind.
 * `cn` resolves `text-<x>` as a font size only when `<x>` is a known step in
 * the `text` theme scale; anything else it treats as a colour. So
 * `cn("text-body", "text-gray-700")` silently dropped the size and kept the
 * colour — two classes it believed were the same property.
 *
 * Nothing looked broken at first because most call sites write their classes
 * as one literal string that never goes through `cn`. The components that do
 * merge — every primitive in this package — were quietly losing their size.
 * Avatars showed it first: the shadcn fallback sets `text-sm` on itself, so
 * with the real step deleted, a 16px circle and a 64px one both drew 14px
 * initials, and only the small ones visibly overflowed.
 *
 * Keep this list in step with the ramp in `styles/theme.css`.
 */
const TEXT_STEPS = [
  "caption",
  "caption-strong",
  "body",
  "body-strong",
  "body-lg",
  "subtitle-1",
  "subtitle-2",
  "title-1",
  "title-2",
  "title-3",
  "large-title",
  "display",
  "avatar-xs",
  "avatar-sm",
  "avatar-md",
  "avatar-lg",
  "avatar-xl",
] as const;

export const cn = createCn({
  extend: { theme: { text: TEXT_STEPS } },
});
