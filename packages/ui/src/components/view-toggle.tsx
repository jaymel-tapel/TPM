"use client";

import Link from "next/link";
import { cn } from "../lib/utils";

/**
 * List / Board. Two views of the same data, and the list stays the default —
 * the brief is explicit that Kanban must not be the default interface.
 *
 * State lives in the URL rather than in component state, so a director can
 * send someone the board they are looking at.
 */
export function ViewToggle({
  listHref,
  boardHref,
  active,
}: {
  listHref: string;
  boardHref: string;
  active: "list" | "board";
}) {
  const item = (isActive: boolean) =>
    cn(
      "rounded-6 px-3 py-1 text-label-14 transition-colors",
      isActive ? "bg-background-100 text-gray-1000" : "text-gray-700 hover:text-gray-1000",
    );

  return (
    <div className="inline-flex items-center gap-1 rounded-8 bg-gray-100 p-1">
      <Link href={listHref} aria-current={active === "list" ? "page" : undefined} className={item(active === "list")}>
        List
      </Link>
      <Link href={boardHref} aria-current={active === "board" ? "page" : undefined} className={item(active === "board")}>
        Board
      </Link>
    </div>
  );
}
