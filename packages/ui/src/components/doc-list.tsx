"use client";

import Link from "next/link";
import { FileText, Quote, X } from "lucide-react";
import { cn } from "../lib/utils";
import { ScopeBadge } from "./doc-tree";
import { StatusBadge } from "./task-meta";
import type { DocBacklinkData, DocHitData, DocRefData } from "../types";

const panel = "rounded-lg border border-gray-400 bg-background-100";
const header =
  "flex items-center justify-between gap-2 border-b border-gray-300 px-4 py-2 text-caption-strong uppercase tracking-[0.08em] text-gray-600";

/**
 * The documents a task points at.
 *
 * A mentioned document has no detach button, and that is not an oversight: the
 * link exists because the description says so, and the place to unsay it is the
 * description. Offering a button that the next save would undo would be a lie
 * about who owns the link.
 */
export function DocRefList({
  docs,
  onDetach,
  onAdd,
}: {
  docs: DocRefData[];
  /** Server action taking `taskId` and `documentId`. Omit for a read-only view. */
  onDetach?: (formData: FormData) => void | Promise<void>;
  /** Rendered in the header — the control that attaches one. */
  onAdd?: React.ReactNode;
}) {
  return (
    <section className={panel}>
      <div className={header}>
        <span>Documents{docs.length > 0 ? ` · ${docs.length}` : ""}</span>
        {onAdd}
      </div>

      {docs.length === 0 ? (
        <p className="px-4 py-6 text-body text-gray-600">
          No documents referenced. Attach one, or type <code>@</code> in the description.
        </p>
      ) : (
        <ul className="divide-y divide-gray-300">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-4 py-2">
              <FileText className="size-4 shrink-0 text-gray-700" strokeWidth={1.75} />
              <Link
                href={doc.href}
                className="min-w-0 flex-1 truncate text-body-strong text-gray-1000 hover:text-blue-800"
              >
                {doc.title}
              </Link>
              <ScopeBadge scope={doc.scope} teamName={doc.teamName} />

              {doc.mentioned ? (
                <span
                  title="Named in the description. Edit the description to remove it."
                  className="inline-flex items-center gap-1 text-caption text-gray-600"
                >
                  <Quote className="size-3" strokeWidth={1.75} />
                  Mentioned
                </span>
              ) : null}

              {onDetach && doc.attached ? (
                <form action={onDetach}>
                  <input type="hidden" name="documentId" value={doc.id} />
                  <button
                    type="submit"
                    aria-label={`Detach ${doc.title}`}
                    title={
                      doc.mentioned
                        ? "Detach. The description still mentions it, so it stays listed."
                        : "Detach"
                    }
                    className="rounded-md p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-1000"
                  >
                    <X className="size-4" strokeWidth={1.75} />
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The other half of a reference: every task pointing at this document. */
export function DocBacklinkList({ tasks }: { tasks: DocBacklinkData[] }) {
  return (
    <section className={panel}>
      <div className={header}>
        <span>Referenced by{tasks.length > 0 ? ` · ${tasks.length}` : ""}</span>
      </div>

      {tasks.length === 0 ? (
        <p className="px-4 py-6 text-body text-gray-600">No tasks reference this yet.</p>
      ) : (
        <ul className="divide-y divide-gray-300">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 px-4 py-2">
              <Link
                href={task.href}
                className={cn(
                  "min-w-0 flex-1 truncate text-body-strong hover:text-blue-800",
                  task.done ? "text-gray-600" : "text-gray-1000",
                )}
              >
                {task.title}
              </Link>
              {task.mentionedOnly ? (
                <Quote className="size-3 shrink-0 text-gray-600" strokeWidth={1.75} />
              ) : null}
              <StatusBadge status={task.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Ranked search hits.
 *
 * The snippet arrives as runs rather than a string with markup in it — what
 * Postgres highlighted is the author's own prose, and prose is never rendered
 * as HTML on the strength of where it came from.
 */
export function DocSearchResults({ hits, query }: { hits: DocHitData[]; query: string }) {
  if (hits.length === 0) {
    return (
      <p className="rounded-lg border border-gray-400 bg-background-100 px-4 py-6 text-body text-gray-600">
        Nothing matches “{query}”.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {hits.map((hit) => (
        <li key={hit.id} className={cn(panel, "px-4 py-3")}>
          <div className="flex items-center gap-2">
            <Link
              href={hit.href}
              className="min-w-0 truncate text-body-strong text-gray-1000 hover:text-blue-800"
            >
              {hit.title}
            </Link>
            <ScopeBadge scope={hit.scope} teamName={hit.teamName} />
          </div>
          {hit.snippet.length > 0 ? (
            <p className="mt-1 text-caption text-gray-700">
              {hit.snippet.map((run, i) =>
                run.hit ? (
                  <mark key={i} className="bg-amber-200 text-gray-1000">
                    {run.text}
                  </mark>
                ) : (
                  <span key={i}>{run.text}</span>
                ),
              )}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
