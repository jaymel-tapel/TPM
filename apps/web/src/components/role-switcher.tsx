"use client";

import { useRef } from "react";
import { ROLE_LABELS, type Role } from "@meridian/ui";
import { switchViewAs } from "@/actions/auth";

/**
 * Demo affordance only — it makes the three levels of the hierarchy
 * demonstrable from a single login. Not part of the production concept.
 */
export function RoleSwitcher({ currentRole }: { currentRole: Role }) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={switchViewAs} className="block">
      <label htmlFor="viewAs" className="mb-1 block text-caption-strong uppercase tracking-[0.08em] text-gray-600">
        Viewing as
      </label>
      <select
        id="viewAs"
        name="role"
        defaultValue={currentRole}
        onChange={() => form.current?.requestSubmit()}
        className="w-full cursor-pointer rounded-md border border-gray-400 bg-background-100 px-2 py-1 text-body-strong text-gray-1000 transition-colors hover:border-gray-500 focus:border-blue-700 focus:outline-none"
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
