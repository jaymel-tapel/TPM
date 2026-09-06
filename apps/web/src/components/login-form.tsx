"use client";

import { useActionState } from "react";
import { Button } from "@meridian/ui/primitives/button";
import { Input } from "@meridian/ui/primitives/input";
import { Label } from "@meridian/ui/primitives/label";
import { login } from "@/actions/auth";

const DEMO = [
  { role: "Team Member", email: "anna.santos@meridian.co" },
  { role: "Account Director", email: "sarah.lim@meridian.co" },
  { role: "Senior Director", email: "elena.rivera@meridian.co" },
];

const label = "mb-2 block text-label-12 uppercase tracking-[0.08em] text-gray-600";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-6 bg-blue-700 text-label-12 text-white">
            M
          </span>
          <span className="text-label-14">Meridian</span>
        </div>
        <div>
          <h1 className="max-w-[12ch] text-heading-48 text-white">
            Know what&rsquo;s <span className="text-amber-500">happening</span>.
          </h1>
          <p className="mt-6 max-w-[42ch] text-copy-16 text-white/60">
            Less managing the task manager. A clear view of today&rsquo;s work, your team, and
            the department.
          </p>
        </div>
        <p className="text-copy-13 text-white/40">Internal department system</p>
      </section>

      <section className="flex items-center justify-center bg-background-100 px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="text-heading-32 text-gray-1000">Sign in</h2>
          <p className="mt-2 text-copy-14 text-gray-700">Use your work email address.</p>

          <form action={formAction} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email" className={label}>
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                defaultValue="anna.santos@meridian.co"
              />
            </div>
            <div>
              <Label htmlFor="password" className={label}>
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                defaultValue="demo1234"
              />
            </div>

            {state?.error ? (
              <p className="rounded-6 bg-red-100 px-3 py-2 text-copy-14 text-red-900">
                {state.error}
              </p>
            ) : null}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-10 rounded-12 border border-gray-400 p-6">
            <p className="mb-3 text-label-12 uppercase tracking-[0.08em] text-gray-600">
              Demo accounts
            </p>
            <ul className="space-y-1.5">
              {DEMO.map((d) => (
                <li key={d.email} className="flex justify-between gap-4 text-copy-13">
                  <span className="text-gray-700">{d.role}</span>
                  <span className="text-gray-1000">{d.email}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-gray-300 pt-3 text-copy-13 text-gray-700">
              Password <span className="text-gray-1000">demo1234</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
