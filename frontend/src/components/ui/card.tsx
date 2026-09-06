import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--line)] bg-[var(--paper)] shadow-[0_1px_3px_rgba(16,24,21,0.06)]",
        className,
      )}
      {...props}
    />
  );
}
