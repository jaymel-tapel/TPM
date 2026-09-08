"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Bring the page up to date when someone comes back to it.
 *
 * Kept even with Ably connected: a socket can drop, a laptop can sleep through
 * a reconnect, and coming back to the tab is exactly when a stale badge is
 * most visible. Costs one render on focus and needs no service.
 */
export function RefreshOnFocus() {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();

    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      // Alt-tabbing quickly should not re-render on every pass.
      if (Date.now() - last < 5_000) return;
      last = Date.now();
      router.refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
