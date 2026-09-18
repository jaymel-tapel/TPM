"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  ChevronRight,
  ShieldCheck,
  FileText,
  LogOut,
  Users,
  MessageSquare,
  Plus,
} from "lucide-react";
import { ROLE_LABELS, UserAvatar, cn, type InboxItemData, type Role } from "@tpm/ui";
import type { NavAccount, NavChild, NavItem } from "@/lib/permissions";
import { logout } from "@/actions/auth";
import { NotificationBell } from "./notification-bell";

const ICONS: Record<NavItem["icon"], typeof CalendarCheck> = {
  chat: MessageSquare,
  today: CalendarCheck,
  docs: FileText,
  accounts: Building2,
  people: Users,
  reports: BarChart3,
  admin: ShieldCheck,
};

/**
 * A left rail rather than a top bar. Navigation here is a fixed, small,
 * role-derived set that never grows, which is exactly the case a rail suits:
 * it stays in the same place on every screen, and the working area gets the
 * full width of the window.
 *
 * Two levels, and the split is the information architecture. Global items work
 * across every client the reader can reach; an account is a container, and
 * everything inside one is about that client alone. There is exactly one
 * client hierarchy in here.
 *
 * The active item is marked by a bar on the leading edge as well as a tint, so
 * it survives being read at a glance or without colour.
 */
/** Three to five, per the handoff. Five is where a scrollable rail starts. */
const RAIL_LIMIT = 5;

const itemStyles =
  "relative flex items-center gap-3 rounded-md px-3 py-2 text-body-strong transition-colors";

function ActiveBar() {
  return (
    <span aria-hidden className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-blue-700" />
  );
}

function GlobalItem({ link, pathname }: { link: NavItem; pathname: string }) {
  const Icon = ICONS[link.icon];
  const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        itemStyles,
        active
          ? "bg-blue-100 text-blue-900"
          : "text-gray-700 hover:bg-gray-100 hover:text-gray-1000",
      )}
    >
      {active ? <ActiveBar /> : null}
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate">{link.label}</span>
      {/* The one badge in the navigation. Chat is a queue; everywhere else in
          the rail is a place, and a count on a place means nothing. */}
      {link.count ? (
        <span className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-blue-700 px-1.5 text-caption-strong text-white">
          {link.count > 9 ? "9+" : link.count}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * One client, and the four pages inside it.
 *
 * The name both navigates and opens: clicking MG takes you to its Overview
 * *and* reveals the rest, which is what anybody means by clicking a client.
 * The chevron only opens, for looking without leaving.
 *
 * The parent row is never tinted. Overview is one of the four children, so on
 * the account's own front page that child carries the active state — tinting
 * the client's name as well would mark two rows for one page and make the
 * account look like a fifth destination alongside its own sections.
 */
function AccountGroup({
  account,
  pathname,
  expanded,
  onOpen,
  onToggle,
}: {
  account: NavAccount;
  pathname: string;
  expanded: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <div>
      <div
        className={cn(
          "relative flex items-center gap-1 rounded-md py-1.5 pl-6 pr-1 text-body-strong transition-colors",
          "text-gray-800 hover:bg-gray-100 hover:text-gray-1000",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${account.name}`}
          className="rounded-md p-0.5 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-1000"
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", expanded && "rotate-90")}
            strokeWidth={2}
          />
        </button>
        <Link href={account.href} onClick={onOpen} className="min-w-0 flex-1 truncate">
          {account.name}
        </Link>
      </div>

      {expanded ? (
        <div className="mt-0.5 space-y-0.5">
          {account.children.map((child) => (
            <SectionRow
              key={child.href}
              child={child}
              pathname={pathname}
              addHref={
                child.children && account.canAddBoard ? `${account.href}/tasks/new` : undefined
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One of an account's four sections, and — for Tasks — the boards under it.
 *
 * Tasks carries a chevron because it opens, and the three that do not carry a
 * spacer the same width, so all four labels line up. A row that expands
 * without saying so is a row people do not know they can expand.
 *
 * The chevron discloses and the label navigates, which is the rule the account
 * row above already follows. Tasks opens itself whenever you are on one of its
 * boards — moving between a client's pipelines is a thing people do all day,
 * and a list you have to reopen is a click on every hop — until somebody works
 * the chevron, after which the choice is theirs.
 */
function SectionRow({
  child,
  pathname,
  addHref,
}: {
  child: NavChild;
  pathname: string;
  /** Renders a create affordance at the foot of an open Tasks group. */
  addHref?: string;
}) {
  const active = pathname === child.href;
  const boards = child.children ?? [];
  const inside = boards.some((board) => pathname === board.href);

  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = boards.length > 0 && (open ?? (active || inside));

  return (
    <div>
      <div
        className={cn(
          "relative flex items-center gap-1 rounded-md py-1.5 pl-8 pr-3 text-body transition-colors",
          active
            ? "bg-blue-100 text-blue-900"
            : "text-gray-700 hover:bg-gray-100 hover:text-gray-1000",
        )}
      >
        {active ? <ActiveBar /> : null}
        {boards.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(!expanded)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${child.label}`}
            className="rounded-md p-0.5 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-1000"
          >
            <ChevronRight
              className={cn("size-3 transition-transform", expanded && "rotate-90")}
              strokeWidth={2}
            />
          </button>
        ) : (
          // Holds the chevron's place so Overview, Campaigns and Team read as
          // the same level as Tasks rather than half a step out from it.
          <span aria-hidden className="size-4 shrink-0" />
        )}
        <Link
          href={child.href}
          aria-current={active ? "page" : undefined}
          className="min-w-0 flex-1 truncate"
        >
          {child.label}
        </Link>
      </div>

      {expanded ? (
        <div className="mt-0.5 space-y-0.5">
          {boards.map((board) => {
            const on = pathname === board.href;
            return (
              <Link
                key={board.href}
                href={board.href}
                // The rail is 224px and a board sits three levels in, so a long
                // name truncates. The full one is a hover away rather than a
                // wider rail or a shorter name.
                title={board.label}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative block truncate rounded-md py-1 pl-16 pr-3 text-caption transition-colors",
                  on
                    ? "bg-blue-100 text-blue-900"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-1000",
                )}
              >
                {on ? <ActiveBar /> : null}
                {board.label}
              </Link>
            );
          })}

          {/* Making a board sits with the boards, not in a settings screen
              somewhere else — the same list, one row further down. */}
          {addHref ? (
            <Link
              href={addHref}
              className="flex items-center gap-2 rounded-md py-1 pl-16 pr-3 text-caption text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-1000"
            >
              <Plus className="size-3 shrink-0" strokeWidth={2} />
              New board
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AppSidebar({
  before,
  accounts,
  after,
  user,
  notifications,
  unread,
}: {
  before: NavItem[];
  accounts: NavAccount[];
  after: NavItem[];
  user: { name: string; role: Role };
  notifications: InboxItemData[];
  unread: number;
}) {
  const pathname = usePathname();

  /*
   * Which account is open. `undefined` means "nobody has said", and the answer
   * comes from the route — following a link into Volvo from anywhere else opens
   * Volvo rather than leaving the page you are on hidden inside a shut group.
   * Once somebody works the chevron the choice is theirs, and `null` is their
   * choice of none.
   */
  const [open, setOpen] = useState<string | null | undefined>(undefined);
  const onPath = accounts.find(
    (a) => pathname === a.href || pathname.startsWith(`${a.href}/`),
  );
  const openId = open === undefined ? (onPath?.id ?? null) : open;

  /*
   * Three to five, not all of them: each account expands, and six expandable
   * clients is a rail you scroll past to reach Docs. The list arrives ranked
   * by the reader's own open work, so the top five are the ones they are
   * actually in — but the account they are *looking at* outranks all of them,
   * and takes the last slot rather than making it six.
   */
  const shown = accounts.slice(0, RAIL_LIMIT);
  if (onPath && !shown.some((a) => a.id === onPath.id)) {
    shown.splice(RAIL_LIMIT - 1, 1, onPath);
  }
  // Alphabetical once chosen. Ranking picks *which*; it should not also make
  // the list reshuffle under somebody as they tick things off.
  shown.sort((a, b) => a.name.localeCompare(b.name));

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
        {before.map((link) => (
          <GlobalItem key={link.href} link={link} pathname={pathname} />
        ))}

        {/* With Chat, not below the accounts: the two queues in the product,
            side by side, and neither of them moves as the client list grows. */}
        <NotificationBell items={notifications} unread={unread} />

        {accounts.length > 0 ? (
          <>
            {/* A label, not a link. The rail's one heading — and no space above
                it for the Senior Director, whose rail starts here. */}
            <p
              className={cn(
                "mb-1 px-3 text-caption-strong uppercase tracking-[0.08em] text-gray-600",
                before.length > 0 && "mt-6",
              )}
            >
              Accounts
            </p>

            <div className="space-y-0.5">
              {shown.map((account) => (
                <AccountGroup
                  key={account.id}
                  account={account}
                  pathname={pathname}
                  expanded={openId === account.id}
                  // Clicking the name opens this one, which closes whichever
                  // was open: five expanded clients is a rail you scroll.
                  onOpen={() => setOpen(account.id)}
                  onToggle={() => setOpen(openId === account.id ? null : account.id)}
                />
              ))}

              {/*
                Only when the cap actually hides something. An "All Accounts"
                row sat here permanently and was a click past the list to reach
                a longer version of the same list — for almost everybody, the
                rail already shows every client they have.
              */}
              {accounts.length > shown.length ? (
                <Link
                  href="/accounts"
                  aria-current={pathname === "/accounts" ? "page" : undefined}
                  className={cn(
                    "relative block truncate rounded-md py-1.5 pl-6 pr-3 text-caption transition-colors",
                    pathname === "/accounts"
                      ? "bg-blue-100 text-blue-900"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-1000",
                  )}
                >
                  {pathname === "/accounts" ? <ActiveBar /> : null}
                  {accounts.length - shown.length} more…
                </Link>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="mt-6 space-y-0.5">
          {after.map((link) => (
            <GlobalItem key={link.href} link={link} pathname={pathname} />
          ))}
        </div>
      </nav>

      <div className="shrink-0 border-t border-gray-300 p-3">
        {/* Reads as a rail item rather than an icon in a corner: it is the
            one thing down here you would go looking for by name. */}
        <form action={logout}>
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
