"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@meridian/ui";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-6 px-3 py-1.5 text-label-14 transition-colors",
        active ? "bg-blue-100 text-blue-900" : "text-gray-700 hover:bg-gray-100 hover:text-gray-1000",
      )}
    >
      {children}
    </Link>
  );
}
