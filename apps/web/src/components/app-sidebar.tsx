"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  ChevronRight,
  Columns3,
  FileText,
  LayoutDashboard,
  LogOut,
  Plus,
  Users,
  UsersRound,
} from "lucide-react";
import { ROLE_LABELS, UserAvatar, cn, type Role } from "@meridian/ui";
import type { NavIcon, NavItem } from "@/lib/permissions";
import { logout } from "@/actions/auth";
import { RoleSwitcher } from "./role-switcher";

const ICONS: Record<NavIcon, typeof CalendarCheck> = {
  today: CalendarCheck,
  boards: Columns3,
  docs: FileText,
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
const itemStyles =
  "relative flex items-center gap-3 rounded-md px-3 py-2 text-body-strong transition-colors";

function ActiveBar() {
  return (
    <span aria-hidden className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-blue-700" />
  );
}

function NavGroup({
  link,
  pathname,
  addHref,
  addLabel,
}: {
  link: NavItem;
  pathname: string;
  /** Renders a create affordance at the foot of an expanded group. */
  addHref?: string;
  addLabel?: string;
}) {
  const Icon = ICONS[link.icon];
  const onSelf = pathname === link.href;
  const inSection = onSelf || pathname.startsWith(`${link.href}/`);
  const hasChildren = Boolean(link.children?.length);

  /*
   * null means "follow the route" — the group opens because you are inside it
   * and closes when you leave. Once someone touches the chevron it becomes
   * their choice and stays that way, which is the behaviour people expect from
   * a disclosure they operated themselves.
   */
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? inSection;

  if (!hasChildren) {
    return (
      <Link
        href={link.href}
        aria-current={inSection ? "page" : undefined}
        className={cn(
          itemStyles,
          inSection
            ? "bg-blue-100 text-blue-900"
            : "text-gray-700 hover:bg-gray-100 hover:text-gray-1000",
        )}
      >
        {inSection ? <ActiveBar /> : null}
        <Icon className="size-4 shrink-0" strokeWidth={1.75} />
        {link.label}
      </Link>
    );
  }

  return (
    <div>
      <div
        className={cn(
          itemStyles,
          "pr-1",
          onSelf
            ? "bg-blue-100 text-blue-900"
            : "text-gray-700 hover:bg-gray-100 hover:text-gray-1000",
        )}
      >
        {onSelf ? <ActiveBar /> : null}
        <Icon className="size-4 shrink-0" strokeWidth={1.75} />
        {/* The label navigates and the chevron discloses. Making the whole row
            do both means one of them is a surprise. */}
        <Link href={link.href} className="flex-1 truncate">
          {link.label}
        </Link>
        <button
          type="button"
          onClick={() => setOpen(!expanded)}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${link.label}`}
          className="rounded-md p-0.5 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-1000"
        >
          <ChevronRight
            className={cn("size-4 transition-transform", expanded && "rotate-90")}
            strokeWidth={1.75}
          />
        </button>
      </div>

      {expanded ? (
        <div className="mt-0.5 space-y-0.5">
          {link.children!.map((child) => {
            const active = pathname === child.href;
            return (
              <Link
                key={child.href}
                href={child.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // Indented to sit under the parent's label, not its icon.
                  "relative block truncate rounded-md py-1.5 pl-10 pr-3 text-body transition-colors",
                  active
                    ? "bg-blue-100 text-blue-900"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-1000",
                )}
              >
                {active ? <ActiveBar /> : null}
                {child.label}
              </Link>
            );
          })}

          {/* Creating a board sits with the boards, not in a settings screen
              somewhere else — it is the same list, one row further down. */}
          {addHref ? (
            <Link
              href={addHref}
              className="flex items-center gap-2 rounded-md py-1.5 pl-10 pr-3 text-body text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-1000"
            >
              <Plus className="size-3.5 shrink-0" strokeWidth={2} />
              {addLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AppSidebar({
  links,
  user,
  showRoleSwitcher,
  canCreateBoard = false,
}: {
  links: NavItem[];
  user: { name: string; role: Role };
  showRoleSwitcher: boolean;
  canCreateBoard?: boolean;
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
        {links.map((link) => (
          <NavGroup
            key={link.href}
            link={link}
            pathname={pathname}
            addHref={canCreateBoard && link.href === "/boards" ? "/boards/new" : undefined}
            addLabel="New board"
          />
        ))}
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
