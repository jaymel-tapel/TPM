"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  ChevronRight,
  ShieldCheck,
  Columns3,
  FileText,
  LayoutDashboard,
  LogOut,
  Plus,
  Users,
  UsersRound,
} from "lucide-react";
import { ROLE_LABELS, UserAvatar, cn, type InboxItemData, type Role } from "@meridian/ui";
import type { NavChild, NavIcon, NavItem } from "@/lib/permissions";
import { logout } from "@/actions/auth";
import { NotificationBell } from "./notification-bell";

const ICONS: Record<NavIcon, typeof CalendarCheck> = {
  today: CalendarCheck,
  boards: Columns3,
  docs: FileText,
  team: Users,
  teams: UsersRound,
  reports: BarChart3,
  overview: LayoutDashboard,
  admin: ShieldCheck,
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

/**
 * A row under a nav group, and — for the Senior Director — the teams that hold
 * the boards beneath it.
 *
 * Two levels and no more. One flat list of every team's boards is a list you
 * read rather than scan; a third level would be the nested spaces the brief
 * refuses.
 */
function NavChildRow({
  child,
  pathname,
  depth = 0,
}: {
  child: NavChild;
  pathname: string;
  depth?: number;
}) {
  const active = pathname === child.href;
  const hasChildren = Boolean(child.children?.length);
  // Groups start open: the point of nesting the boards is to see them.
  const [open, setOpen] = useState(true);

  // pl-10 at the first level lines up under the parent's label rather than its
  // icon; each level after that steps in by one more.
  const indent = depth === 0 ? "pl-10" : "pl-14";
  const shell = cn(
    "relative block rounded-md py-1.5 pr-3 text-body transition-colors",
    indent,
    active
      ? "bg-blue-100 text-blue-900"
      : "text-gray-700 hover:bg-gray-100 hover:text-gray-1000",
  );

  const body = (
    <>
      {active ? <ActiveBar /> : null}
      <span className="block truncate">{child.label}</span>
      {/* A quieter second line — the rail is 224px and the label deserves it. */}
      {child.note ? (
        <span className="block truncate text-caption text-gray-600">{child.note}</span>
      ) : null}
    </>
  );

  if (!hasChildren) {
    return child.href ? (
      <Link href={child.href} aria-current={active ? "page" : undefined} className={shell}>
        {body}
      </Link>
    ) : (
      <div className={shell}>{body}</div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(shell, "flex w-full items-center gap-2 text-left")}
      >
        <ChevronRight
          className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")}
          strokeWidth={2}
        />
        <span className="min-w-0 flex-1 truncate">{child.label}</span>
      </button>

      {open ? (
        <div className="mt-0.5 space-y-0.5">
          {child.children!.map((grandchild) => (
            <NavChildRow
              key={grandchild.href ?? grandchild.label}
              child={grandchild}
              pathname={pathname}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
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
   * Open by default, not "open because you are already inside it".
   *
   * The earlier behaviour followed the route, which meant the one moment you
   * could not see the other boards was the moment you were on a board and
   * wanted to switch. Boards are how people move between clients all day, and
   * a list you have to open first is a click on every hop.
   *
   * The chevron still works, and once someone uses it the choice is theirs.
   */
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? true;

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
          {link.children!.map((child) => (
            <NavChildRow key={child.href ?? child.label} child={child} pathname={pathname} />
          ))}

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
  canCreateBoard = false,
  notifications,
  unread,
}: {
  links: NavItem[];
  user: { name: string; role: Role };
  canCreateBoard?: boolean;
  notifications: InboxItemData[];
  unread: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-gray-400 bg-background-100">
      <Link
        href="/"
        className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-300 px-4"
      >
        <Image
          src="/mb-mark.png"
          alt=""
          width={24}
          height={24}
          className="shrink-0 rounded-md"
        />
        <span className="text-body-strong text-gray-1000">MB Advertising</span>
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
        {/* Above the account, below the navigation: the last thing read on the
            way down, and the one row whose job is to be noticed. */}
        <NotificationBell items={notifications} unread={unread} />

        {/* Reads as a rail item rather than an icon in a corner: it is the
            one thing down here you would go looking for by name. */}
        <form action={logout} className="mt-3">
          <button
            type="submit"
            className={cn(
              itemStyles,
              "w-full cursor-pointer text-gray-700 hover:bg-gray-100 hover:text-gray-1000",
            )}
          >
            <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
            Sign out
          </button>
        </form>

        {/* Last of all: who the rest of the rail is describing. It is a label,
            not a control — everything you would do with the account is in the
            rows above it. */}
        <div className="mt-3 flex items-center gap-2 border-t border-gray-300 px-1 pt-3">
          <UserAvatar name={user.name} size="md" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-body-strong leading-tight text-gray-1000">
              {user.name}
            </div>
            <div className="truncate text-caption leading-tight text-gray-600">
              {ROLE_LABELS[user.role]}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
