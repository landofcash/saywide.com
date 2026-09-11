import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-3", className)} aria-label="Saywide home">
      <Image src="/images/saywide-logo.png" alt="" width={56} height={40} className="h-10 w-14 object-contain" />
      {!compact && <span className="font-display text-xl font-bold tracking-[-0.025em]">saywide</span>}
    </Link>
  );
}
