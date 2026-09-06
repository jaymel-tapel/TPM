import { cn } from "../lib/utils";
import { Percent } from "./stat";

/**
 * The one documented exception to the Geist surfaces: navy, reserved for
 * leadership summaries because the brief asks for it. Used here and nowhere
 * else in the product.
 */
export function HeroPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-12 bg-navy px-8 py-8 text-white shadow-navy", className)}>
      {children}
    </section>
  );
}

/** The single amber number a screen is allowed. */
export function HighlightMetric({
  value,
  label,
  progress,
}: {
  value: number;
  label: string;
  progress?: number;
}) {
  return (
    <div className="min-w-48">
      <p className="tabular text-heading-72 text-amber-500">
        <Percent value={value} muted={false} />
      </p>
      <p className="mt-2 text-copy-14 text-white/70">{label}</p>
      {progress !== undefined ? (
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
