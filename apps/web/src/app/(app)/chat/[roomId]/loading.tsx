import { Skeleton } from "@meridian/ui/primitives/skeleton";

/**
 * The conversation pane, waiting. Alternating alignment because a thread is
 * two people talking, and a column of identical left-aligned blocks does not
 * read as one.
 */
export default function Loading() {
  const mine = [false, true, false, false, true];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-gray-300 px-6 py-4">
        <Skeleton className="h-5 w-40" />
      </header>
      <div className="flex-1 space-y-4 overflow-hidden p-6">
        {mine.map((own, i) => (
          <div key={i} className={own ? "flex justify-end" : "flex"}>
            <Skeleton className={own ? "h-10 w-2/5 rounded-lg" : "h-10 w-1/2 rounded-lg"} />
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-gray-300 p-4">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}
