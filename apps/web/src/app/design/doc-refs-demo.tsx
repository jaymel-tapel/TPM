"use client";

import { DocRefList } from "@tpm/ui";
import type { DocRefData } from "@tpm/ui";

/**
 * `DocRefList` takes a detach action, and functions cannot cross the
 * server/client boundary — the gallery page is a server component, so the
 * detachable state needs its own client wrapper to supply one. Same reason as
 * `ErrorStateDemo`.
 */
export function DocRefListDemo({ docs }: { docs: DocRefData[] }) {
  return <DocRefList docs={docs} onDetach={() => {}} />;
}
