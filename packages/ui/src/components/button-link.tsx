import Link from "next/link";
import { Button } from "../primitives/button";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * A button that navigates. Base UI composes through `render` rather than
 * `asChild`, so this keeps that detail in the design system instead of at
 * every call site.
 *
 * `nativeButton={false}` is required: this renders an anchor, and Base UI
 * warns (correctly) that a non-<button> carrying button semantics breaks
 * forms and assistive tech. A link that navigates should be a link.
 */
export function ButtonLink({
  href,
  children,
  ...props
}: { href: string } & Omit<ButtonProps, "render">) {
  return (
    <Button {...props} nativeButton={false} render={<Link href={href} />}>
      {children}
    </Button>
  );
}
