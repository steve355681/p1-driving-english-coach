"use client";

import { cn } from "@/lib/utils";

export interface Option<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * Single-select group used by the launcher. Rendered as real radio inputs so
 * it stays keyboard- and screen-reader-accessible; the visual is on the label.
 */
export function OptionGroup<T extends string | number>({
  name,
  options,
  value,
  onChange,
  columns = 1,
}: {
  name: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
}) {
  const gridCols = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

  return (
    <div role="radiogroup" className={cn("grid gap-2", gridCols[columns])}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex min-h-14 cursor-pointer flex-col justify-center rounded-2xl border px-4 py-3 transition-colors",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
              selected
                ? "border-brand bg-brand/10"
                : "border-line bg-surface hover:bg-surface-2",
            )}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={selected}
              onChange={() => onChange(option.value)}
            />
            <span
              className={cn(
                "text-sm font-medium",
                selected ? "text-brand" : "text-fg",
              )}
            >
              {option.label}
            </span>
            {option.hint ? (
              <span className="mt-0.5 text-xs text-muted">{option.hint}</span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}
