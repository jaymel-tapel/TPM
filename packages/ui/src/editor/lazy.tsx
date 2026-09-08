"use client";

import dynamic from "next/dynamic";

/**
 * BlockNote reaches for `window` while it builds its schema, so it cannot be
 * server-rendered at all: left alone, every page carrying a description threw
 * during SSR and React silently fell back to rendering it on the client.
 * Loading it dynamically makes that explicit and keeps the editor out of the
 * server bundle entirely.
 *
 * The cost is that a description is not in the initial HTML. That is the trade
 * BlockNote imposes; the placeholder below reserves the space so the page does
 * not jump when it arrives.
 */
function EditorSkeleton({ readOnly }: { readOnly?: boolean }) {
  return (
    <div
      aria-hidden
      className={
        readOnly
          ? "h-16 animate-pulse rounded-lg bg-gray-100"
          : "h-24 animate-pulse rounded-lg border border-gray-400 bg-gray-100"
      }
    />
  );
}

export const RichTextEditor = dynamic(
  () => import("./rich-text").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <EditorSkeleton /> },
);

export const RichTextView = dynamic(
  () => import("./rich-text").then((m) => m.RichTextView),
  { ssr: false, loading: () => <EditorSkeleton readOnly /> },
);
