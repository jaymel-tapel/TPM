import { cn } from "../lib/utils";

/**
 * The product shows few metrics, large. One number, one short label — never a
 * widget. Sizes are steps off the Geist heading ramp.
 */
const SIZES = {
  sm: "text-title-3",
  md: "text-title-1",
  lg: "text-large-title",
  xl: "text-display",
} as const;

export function Stat({
  value,
  label,
  size = "md",
  tone = "default",
  className,
}: {
  value: React.ReactNode;
  label: string;
  size?: keyof typeof SIZES;
  tone?: "default" | "danger" | "onDark" | "highlight";
  className?: string;
}) {
  const color = {
    default: "text-gray-1000",
    danger: "text-red-700",
    onDark: "text-white",
    highlight: "text-amber-500",
  }[tone];

  const labelColor = tone === "onDark" || tone === "highlight" ? "text-white/60" : "text-gray-700";

  return (
    <div className={className}>
      <div className={cn("tabular", SIZES[size], color)}>{value}</div>
      <div className={cn("mt-1 text-caption", labelColor)}>{label}</div>
    </div>
  );
}

/**
 * A percentage with the sign set at half the number's size, so the number
 * leads. The one place that ratio is expressed — call sites never size a "%".
 */
export function Percent({ value, muted = true }: { value: number; muted?: boolean }) {
  return (
    <>
      {value}
      <span className={cn("text-[0.5em]", muted && "text-gray-500")}>%</span>
    </>
  );
}
