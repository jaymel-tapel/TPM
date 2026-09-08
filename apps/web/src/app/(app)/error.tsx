"use client";

import { useEffect } from "react";
import { ErrorState } from "@meridian/ui";

/**
 * Covers every authenticated screen. Without it a failed query renders the raw
 * Next.js error page, which shows a stack trace and offers no way back.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[meridian]", error);
  }, [error]);

  return (
    <div className="py-8">
      <ErrorState onRetry={reset} />
    </div>
  );
}
