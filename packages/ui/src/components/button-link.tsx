import Link from "next/link";
import { Button } from "../primitives/button";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * A button that navigates. Base UI composes through `render` rather than
 * `asChild`, so this keeps that detail in the design system instead of at
 * every call site.
 */
export function ButtonLink({
  href,
  children,
  ...props
}: { href: string } & Omit<ButtonProps, "render">) {
  return (
    <Button {...props} render={<Link href={href} />}>
      {children}
    </Button>
  );
}
