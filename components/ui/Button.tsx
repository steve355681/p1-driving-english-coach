import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
/** `driving` is deliberately oversized: it is the only tap target that should
 *  ever be used with the phone mounted in a car. */
type Size = "md" | "lg" | "driving";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-base hover:bg-brand-strong",
  secondary: "bg-surface-2 text-fg border border-line hover:bg-line",
  ghost: "text-muted hover:text-fg",
  danger: "bg-state-error text-base hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-14 px-6 text-base",
  driving: "min-h-28 px-6 text-2xl font-semibold",
};

function classes(variant: Variant, size: Size, fullWidth: boolean) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
  );
}

interface BaseProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  ...props
}: BaseProps & ComponentProps<"button">) {
  return (
    <button
      className={cn(classes(variant, size, fullWidth), className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  ...props
}: BaseProps & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(classes(variant, size, fullWidth), className)}
      {...props}
    />
  );
}
