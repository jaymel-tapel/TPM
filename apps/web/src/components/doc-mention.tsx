"use client";

import { useCallback, useRef } from "react";
import type { MentionItem } from "@meridian/ui/editor";
import { listMentionableDocs, listMentionablePeople } from "@/actions/docs";

/**
 * Backs the `@` picker: people and documents in one list.
 *
 * One trigger, because `@` already means "point at a thing" and asking anyone
 * to remember a second keystroke for the other sort of thing would be a worse
 * idea than a mixed list. People come first — a name is the more common reach
 * in a comment, and a document is usually looked for by title.
 *
 * One fetch each, then matching in the browser. BlockNote calls `getItems` on
 * every keystroke with no debounce of its own, so a request per character is a
 * request storm; and this is name completion, not search — the field on /docs
 * is where the bodies get looked through.
 *
 * The identity has to be stable: BlockNote lists `getItems` as a `useEffect`
 * dependency, so a fresh function each render re-queries in a loop. Hence
 * `useCallback` with no dependencies, and the caches in refs.
 */
export function useMentionSource(): (query: string) => Promise<MentionItem[]> {
  const docs = useRef<Promise<MentionItem[]> | null>(null);
  const people = useRef<Promise<MentionItem[]> | null>(null);

  return useCallback(async (query: string) => {
    docs.current ??= listMentionableDocs()
      .then((rows) => rows.map((row) => ({ ...row, kind: "doc" as const })))
      .catch(() => []);
    people.current ??= listMentionablePeople().catch(() => []);

    const [documents, persons] = await Promise.all([docs.current, people.current]);

    const q = query.trim().toLowerCase();
    const matches = (item: MentionItem) =>
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.subtitle?.toLowerCase().includes(q) ?? false);

    // People first, then documents — each capped, so one long list cannot
    // crowd the other out of the menu.
    return [...persons.filter(matches).slice(0, 6), ...documents.filter(matches).slice(0, 6)];
  }, []);
}
