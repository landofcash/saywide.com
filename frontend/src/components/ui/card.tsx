import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-[var(--line)] bg-[var(--paper)] shadow-[0_18px_50px_rgba(36,48,44,0.07)]",
        className,
      )}
      {...props}
    />
  );
}
