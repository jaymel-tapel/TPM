"use client";

import { useSyncExternalStore } from "react";

/**
 * The motion scale, readable from JavaScript.
 *
 * The same values `theme.css` declares as `--duration-*` and `--ease-*`. They
 * are repeated here rather than read off the computed style because the things
 * that need them — a drag library, an animation API — take numbers and easing
 * strings, not class names, and every value in this system has to cite a token
 * rather than be picked at a call site.
 */
export const DURATION = { faster: 100, fast: 150, normal: 200 } as const;

export const EASE = {
  standard: "cubic-bezier(0.33, 0, 0.67, 1)",
  decelerate: "cubic-bezier(0.1, 0.9, 0.2, 1)",
} as const;

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * The preference `theme.css` already honours, made readable in JavaScript.
 *
 * The stylesheet's rule reaches CSS transitions, including the inline ones a
 * drag library writes — an author `!important` declaration beats an inline
 * one. It does not reach the Web Animations API, which is what a drop
 * animation uses, so anything scripted has to ask here and skip the animation
 * rather than shorten it.
 *
 * `useSyncExternalStore` rather than an effect: the server has no preference to
 * report, and `false` is the honest answer for the first paint.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
