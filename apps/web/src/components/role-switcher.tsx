"use client";

import { useRef } from "react";
import { ROLE_LABELS, type Role } from "@meridian/ui";
import { switchViewAs } from "@/actions/auth";

/**
 * Demo affordance only — it makes the three levels of the hierarchy
 * demonstrable from a single login. Not part of the production concept.
 *
 * It floats over the page rather than sitting in the rail, which is where it
 * belongs precisely because it does not belong: the rail is the product, and
 * this is scaffolding for showing the product. Bottom centre keeps it off the
 * rail, off the command bars along the top, and out of the way of the one
 * column people actually read.
 */
export function RoleSwitcher({ currentRole }: { currentRole: Role }) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      action={switchViewAs}
      className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-gray-400 bg-background-100 px-3 py-2 shadow-medium"
    >
      <label
        htmlFor="viewAs"
        className="text-caption-strong uppercase tracking-[0.08em] text-gray-600"
      >
        Viewing as
      </label>
      <select
        id="viewAs"
        name="role"
        defaultValue={currentRole}
        onChange={() => form.current?.requestSubmit()}
        className="cursor-pointer rounded-md border border-gray-400 bg-background-100 px-2 py-1 text-body-strong text-gray-1000 transition-colors hover:border-gray-500 focus:border-blue-700 focus:outline-none"
      >
        {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
    </form>
  );
}
