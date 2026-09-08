"use client";

import { useCallback, useRef } from "react";
import type { MentionItem } from "@meridian/ui/editor";
import { listMentionableDocs } from "@/actions/docs";

/**
 * Backs the `@` picker in a description.
 *
 * One fetch, then matching in the browser. BlockNote calls `getItems` on every
 * keystroke with no debounce of its own, so a request per character is a
 * request storm; and this is name completion, not search — the field on /docs
 * is where the bodies get looked through. The list of documents one person can
 * read is small enough to hold.
 *
 * The identity has to be stable: BlockNote lists `getItems` as a `useEffect`
 * dependency, so a fresh function each render re-queries in a loop. Hence
 * `useCallback` with no dependencies, and the cache in a ref.
 *
 * The cost is that a document written in another tab is not offered until this
 * form is reloaded, which for a form you are in the middle of filling in is the
 * right trade.
 */
export function useDocMentionSource(): (query: string) => Promise<MentionItem[]> {
  const index = useRef<Promise<MentionItem[]> | null>(null);

  return useCallback(async (query: string) => {
    index.current ??= listMentionableDocs().catch(() => []);
    const docs = await index.current;

    const q = query.trim().toLowerCase();
    const matched = q
      ? docs.filter(
          (d) =>
            d.title.toLowerCase().includes(q) || d.subtitle?.toLowerCase().includes(q),
        )
      : docs;
    return matched.slice(0, 10);
  }, []);
}
