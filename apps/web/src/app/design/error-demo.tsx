"use client";

import { ErrorState } from "@meridian/ui";

/**
 * `ErrorState` takes an `onRetry` callback, and functions cannot cross the
 * server/client boundary — the gallery page is a server component, so the
 * demo needs its own client wrapper to supply one.
 */
export function ErrorStateDemo() {
  return <ErrorState onRetry={() => {}} />;
}
