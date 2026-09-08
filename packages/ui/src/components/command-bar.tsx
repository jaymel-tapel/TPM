import Link from "next/link";
import { cn } from "../lib/utils";

/**
 * A thin strip of actions under a page title. Actions read as icon plus word —
 * the icon makes the row scannable, the word makes it unambiguous, and a bar
 * of icons alone would be a guessing game.
 *
 * It is a strip rather than a row of buttons because these are page-level
 * verbs, not the one thing a form is for: a page has exactly one primary
 * button, and it is not in here.
 */
export function CommandBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 border-b border-gray-300 pb-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

const commandStyles =
  "inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-body-strong transition-colors disabled:cursor-not-allowed disabled:text-gray-500";

export function Command({
  icon: Icon,
  children,
  href,
  onClick,
  type = "button",
  tone = "default",
  active = false,
  disabled = false,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  tone?: "default" | "primary" | "danger";
  active?: boolean;
  disabled?: boolean;
}) {
  const toned = active
    ? "bg-blue-100 text-blue-900"
    : {
        default: "text-gray-800 hover:bg-gray-100 hover:text-gray-1000",
        primary: "text-blue-900 hover:bg-blue-100",
        danger: "text-red-700 hover:bg-red-100",
      }[tone];

  const content = (
    <>
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      {children}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn(commandStyles, toned)}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cn(commandStyles, toned)}>
      {content}
    </button>
  );
}

/** A hairline between groups of commands. */
export function CommandDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-gray-300" />;
}
