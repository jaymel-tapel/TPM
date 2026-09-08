import { cn } from "../lib/utils";

/** Tracked-out label. Geist `label-12` in gray-600, with an optional hairline. */
export function Eyebrow({
  children,
  tone = "muted",
  rule = false,
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "danger" | "onDark";
  rule?: boolean;
  className?: string;
}) {
  const color = {
    muted: "text-gray-600",
    danger: "text-red-700",
    onDark: "text-white/50",
  }[tone];

  return (
    <p
      className={cn(
        "flex items-center gap-3 text-caption-strong uppercase tracking-[0.08em]",
        color,
        className,
      )}
    >
      <span className="shrink-0">{children}</span>
      {rule ? (
        <span
          aria-hidden
          className={cn("h-px flex-1", tone === "onDark" ? "bg-white/15" : "bg-gray-300")}
        />
      ) : null}
    </p>
  );
}

export function SectionHeader({
  children,
  aside,
  className,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-baseline justify-between gap-4", className)}>
      <h2 className="text-subtitle-1 text-gray-1000">{children}</h2>
      {aside ? <div className="text-caption text-gray-600">{aside}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  aside,
  commands,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
  /** A CommandBar. Page-level verbs sit under the title, not beside it. */
  commands?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          {eyebrow ? <Eyebrow className="mb-3">{eyebrow}</Eyebrow> : null}
          <h1 className="text-title-1 text-gray-1000">{title}</h1>
          {subtitle ? <div className="mt-2 text-body text-gray-700">{subtitle}</div> : null}
        </div>
        {aside}
      </div>
      {/*
        Actions go in a strip below the title rather than floating beside it,
        so the same verbs land in the same place on every screen no matter how
        long the title runs.
      */}
      {commands ? <div className="mt-4">{commands}</div> : null}
    </div>
  );
}

/** Flat surface: 1px border, no shadow. The default way to group anything. */
export function Panel({
  children,
  className,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "danger" | "quiet";
}) {
  const shell = {
    default: "border-gray-400 bg-background-100",
    danger: "border-red-300 bg-background-100",
    quiet: "border-gray-300 bg-background-100",
  }[tone];

  return <div className={cn("rounded-xl border", shell, className)}>{children}</div>;
}
