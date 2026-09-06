import Link from "next/link";

import { cn } from "@/lib/utils";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-3", className)} aria-label="Saywide home">
      <span className="relative grid size-10 place-items-center rounded-lg bg-[var(--ink)] text-white">
        <span className="absolute left-2.5 h-4 w-0.5 rounded-full bg-[var(--mint)]" />
        <span className="absolute left-[1.15rem] h-6 w-0.5 rounded-full bg-[var(--coral)]" />
        <span className="absolute right-2.5 h-3 w-0.5 rounded-full bg-white" />
      </span>
      {!compact && <span className="font-display text-xl font-bold tracking-[-0.025em]">saywide</span>}
    </Link>
  );
}
