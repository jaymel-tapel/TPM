"use client";

import { Button } from "../primitives/button";

/**
 * What a route shows when its data could not be loaded. Deliberately plain: it
 * says which part of the product failed and offers the one action that might
 * help, rather than showing a stack trace or pretending the screen is empty.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "This screen could not be loaded. It is usually a temporary problem with the connection to the database.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-400 bg-background-100 px-6 py-12 text-center">
      <p className="text-subtitle-1 text-gray-1000">{title}</p>
      <p className="mx-auto mt-2 max-w-prose text-body text-gray-700">{description}</p>
      {onRetry ? (
        <Button className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
