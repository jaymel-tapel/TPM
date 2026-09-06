import Link from "next/link";
import { Button } from "@meridian/ui/primitives/button";
import { Separator } from "@meridian/ui/primitives/separator";
import { ROLE_LABELS, UserAvatar } from "@meridian/ui";
import { logout } from "@/actions/auth";
import { demoSwitcherEnabled, type Session } from "@/lib/auth";
import { navFor } from "@/lib/permissions";
import { NavLink } from "./nav-link";
import { RoleSwitcher } from "./role-switcher";

export function NavBar({ session }: { session: Session }) {
  const links = navFor(session.user.role);

  return (
    <header className="sticky top-0 z-30 border-b border-gray-400 bg-background-100">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid size-6 place-items-center rounded-6 bg-blue-700 text-label-12 text-white">
            M
          </span>
          <span className="text-label-14 text-gray-1000">Meridian</span>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <NavLink key={link.href} href={link.href}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {demoSwitcherEnabled ? <RoleSwitcher currentRole={session.user.role} /> : null}

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="text-label-14 leading-tight text-gray-1000">
                {session.user.name}
              </div>
              <div className="text-copy-13 leading-tight text-gray-600">
                {ROLE_LABELS[session.user.role]}
              </div>
            </div>
            <UserAvatar name={session.user.name} size="md" />
          </div>

          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
