import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The phone-width column every screen lives in. Mobile-first: on desktop it
 * simply centres rather than reflowing into a wide layout, because the product
 * is only ever really used on a phone.
 */
export function MobileShell({
  children,
  className,
  withBottomNav = false,
}: {
  children: ReactNode;
  className?: string;
  withBottomNav?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-md flex-col px-5",
        withBottomNav && "pb-24",
        className,
      )}
    >
      {children}
    </div>
  );
}
