"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@meridian/ui/primitives/button";
import { cn } from "@meridian/ui";

export type ChipGroup = {
  param: string;
  label: string;
  options: { value: string; label: string }[];
};

/**
 * Compact dropdown chips — filters appear only where they are useful, and
 * never as a query builder.
 */
export function FilterChips({ groups }: { groups: ChipGroup[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(param: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(param, value);
    else next.delete(param);
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }

  const anyActive = groups.some((g) => params.get(g.param));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {groups.map((group) => {
        const value = params.get(group.param) ?? "";
        return (
          <label
            key={group.param}
            className={cn(
              "inline-flex cursor-pointer items-center rounded-6 border px-2 py-1 text-label-14 transition-colors",
              value
                ? "border-blue-700 bg-blue-100 text-blue-900"
                : "border-gray-400 bg-background-100 text-gray-700 hover:border-gray-500 hover:text-gray-1000",
            )}
          >
            <span className="sr-only">{group.label}</span>
            <select
              value={value}
              onChange={(e) => set(group.param, e.target.value)}
              className="cursor-pointer appearance-none bg-transparent pr-1 outline-none"
            >
              <option value="">{group.label}</option>
              {group.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        );
      })}

      {anyActive ? (
        <Button variant="ghost" size="sm" onClick={() => router.replace(pathname, { scroll: false })}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
