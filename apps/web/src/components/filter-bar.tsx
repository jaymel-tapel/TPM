"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@meridian/ui/primitives/select";

export type FilterOption = { value: string; label: string };

/**
 * A compact dropdown chip that writes its choice into the URL.
 *
 * The brief asks for filter chips and refuses a query builder, and the URL is
 * what keeps them honest: a filtered view survives a reload and can be sent to
 * somebody, which is most of what people actually want from a saved view. No
 * state to store, nothing to configure, and the server does the filtering.
 *
 * The empty string is "all", and it is removed from the URL rather than
 * written as `?person=` — a parameter that means nothing should not be there.
 */
export function FilterSelect({
  name,
  value,
  all,
  options,
}: {
  name: string;
  value: string;
  /** What the unfiltered choice is called — "All people", "All campaigns". */
  all: string;
  options: FilterOption[];
}) {
  const router = useRouter();

  const choose = (next: string) => {
    const params = new URLSearchParams(window.location.search);
    if (next) params.set(name, next);
    else params.delete(name);
    const query = params.toString();
    router.push(`${window.location.pathname}${query ? `?${query}` : ""}`);
  };

  const label = (v: string) => options.find((o) => o.value === v)?.label ?? all;

  return (
    <Select value={value} onValueChange={(v) => choose(String(v ?? ""))}>
      <SelectTrigger className="h-8 w-auto min-w-40 gap-2 text-body">
        <SelectValue>{(v) => label(String(v ?? ""))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">{all}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
