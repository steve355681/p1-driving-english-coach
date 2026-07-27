"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: ROUTES.launcher, label: "開始" },
  { href: ROUTES.dashboard, label: "進度" },
  { href: ROUTES.settings, label: "設定" },
];

/**
 * Only rendered outside driving mode. The live session screen has no nav on
 * purpose — nothing there should invite a tap while the car is moving.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur">
      <ul className="mx-auto flex w-full max-w-md pb-safe pt-2">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center justify-center rounded-xl text-sm font-medium transition-colors",
                  active ? "text-brand" : "text-muted hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
