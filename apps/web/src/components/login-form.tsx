"use client";

import { useActionState } from "react";
import Image from "next/image";
import { Button } from "@meridian/ui/primitives/button";
import { Input } from "@meridian/ui/primitives/input";
import { Label } from "@meridian/ui/primitives/label";
import { login } from "@/actions/auth";

const DEMO = [
  { role: "Team Member", email: "anna.santos@demo.co" },
  { role: "Account Director", email: "sarah.lim@demo.co" },
  { role: "Senior Director", email: "elena.rivera@demo.co" },
];

const label = "mb-2 block text-caption-strong uppercase tracking-[0.08em] text-gray-600";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <Image
            src="/mb-mark.png"
            alt=""
            width={24}
            height={24}
            className="shrink-0 rounded-md"
          />
          <span className="text-body-strong">MB Advertising</span>
        </div>
        <div>
          <h1 className="max-w-[12ch] text-large-title text-white">
            Know what&rsquo;s <span className="text-amber-500">happening</span>.
          </h1>
          <p className="mt-6 max-w-[42ch] text-body-lg text-white/60">
            Less managing the task manager. A clear view of today&rsquo;s work, your account, and
            the department.
          </p>
        </div>
        <p className="text-caption text-white/40">Internal department system</p>
      </section>

      <section className="flex items-center justify-center bg-background-100 px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="text-title-1 text-gray-1000">Sign in</h2>
          <p className="mt-2 text-body text-gray-700">Use your work email address.</p>

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
                defaultValue="anna.santos@demo.co"
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
              <p className="rounded-md bg-red-100 px-3 py-2 text-body text-red-900">
                {state.error}
              </p>
            ) : null}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-10 rounded-xl border border-gray-400 p-6">
            <p className="mb-3 text-caption-strong uppercase tracking-[0.08em] text-gray-600">
              Demo accounts
            </p>
            <ul className="space-y-1.5">
              {DEMO.map((d) => (
                <li key={d.email} className="flex justify-between gap-4 text-caption">
                  <span className="text-gray-700">{d.role}</span>
                  <span className="text-gray-1000">{d.email}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-gray-300 pt-3 text-caption text-gray-700">
              Password <span className="text-gray-1000">demo1234</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
