import Link from "next/link";
import { cn } from "../lib/utils";
import type { AttentionItemData } from "../types";

/**
 * Leadership gets sentences, not charts to interpret. Nothing here is a metric
 * the reader has to decode.
 */
export function AttentionCard({
  item,
  tone = "light",
}: {
  item: AttentionItemData;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  const high = item.severity === "high";

  return (
    <Link
      href={item.href ?? "#"}
      aria-disabled={!item.href}
      tabIndex={item.href ? undefined : -1}
      className={cn(
        "group flex items-start gap-3 rounded-12 border px-4 py-3 transition-colors",
        dark
          ? "border-white/15 bg-white/5 hover:bg-white/10"
          : "border-gray-400 bg-background-100 hover:bg-gray-100",
        !item.href && "pointer-events-none",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          high ? "bg-red-700" : "bg-amber-500",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-label-14", dark ? "text-white" : "text-gray-1000")}>
          {item.headline}
        </span>
        <span className={cn("block text-copy-13", dark ? "text-white/60" : "text-gray-700")}>
          {item.detail}
        </span>
      </span>
      {item.href ? (
        <span
          className={cn(
            "self-center text-copy-14 transition-transform group-hover:translate-x-0.5",
            dark ? "text-white/40" : "text-gray-500",
          )}
        >
          →
        </span>
      ) : null}
    </Link>
  );
}

export function NeedsAttention({
  items,
  tone = "light",
}: {
  items: AttentionItemData[];
  tone?: "light" | "dark";
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-12 border border-dashed border-gray-400 px-4 py-8 text-center">
        <p className="text-copy-14 text-gray-600">Nothing needs attention right now.</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <li key={i}>
          <AttentionCard item={item} tone={tone} />
        </li>
      ))}
    </ul>
  );
}
