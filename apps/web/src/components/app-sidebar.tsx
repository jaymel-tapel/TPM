"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  ListChecks,
  LayoutDashboard,
  LogOut,
  Users,
  UsersRound,
} from "lucide-react";
import { ROLE_LABELS, UserAvatar, cn, type Role } from "@meridian/ui";
import type { NavIcon, NavItem } from "@/lib/permissions";
import { logout } from "@/actions/auth";
import { RoleSwitcher } from "./role-switcher";

const ICONS: Record<NavIcon, typeof CalendarCheck> = {
  today: CalendarCheck,
  myTasks: ListChecks,
  team: Users,
  teams: UsersRound,
  reports: BarChart3,
  overview: LayoutDashboard,
};

/**
 * A left rail rather than a top bar. Navigation here is a fixed, small,
 * role-derived set that never grows, which is exactly the case a rail suits:
 * it stays in the same place on every screen, and the working area gets the
 * full width of the window.
 *
 * The active item is marked by a bar on the leading edge as well as a tint, so
 * it survives being read at a glance or without colour.
 */
export function AppSidebar({
  links,
  user,
  showRoleSwitcher,
}: {
  links: NavItem[];
  user: { name: string; role: Role };
  showRoleSwitcher: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-gray-400 bg-background-100">
      <Link
        href="/"
        className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-300 px-4"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-blue-700 text-caption-strong text-white">
          M
        </span>
        <span className="text-body-strong text-gray-1000">Meridian</span>
      </Link>

      <nav className="flex-1 overflow-y-auto p-2">
        {links.map((link) => {
          const Icon = ICONS[link.icon];
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-body-strong transition-colors",
                active
                  ? "bg-blue-100 text-blue-900"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-1000",
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-blue-700"
                />
              ) : null}
              <Icon className="size-4 shrink-0" strokeWidth={1.75} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-gray-300 p-3">
        {showRoleSwitcher ? <RoleSwitcher currentRole={user.role} /> : null}

        <div className="mt-3 flex items-center gap-2">
          <UserAvatar name={user.name} size="md" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-body-strong leading-tight text-gray-1000">{user.name}</div>
            <div className="truncate text-caption leading-tight text-gray-600">
              {ROLE_LABELS[user.role]}
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-1000"
            >
              <LogOut className="size-4" strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
