import Link from "next/link";
import { Button } from "@/components/ui/button";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * A button that navigates. Base UI's Button assumes a native <button> unless
 * told otherwise, so `nativeButton={false}` is set here once rather than at
 * every call site.
 */
export function ButtonLink({
  href,
  children,
  ...props
}: Omit<ButtonProps, "render" | "nativeButton"> & {
  href: React.ComponentProps<typeof Link>["href"];
}) {
  return (
    <Button nativeButton={false} render={<Link href={href} />} {...props}>
      {children}
    </Button>
  );
}
