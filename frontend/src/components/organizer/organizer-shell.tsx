"use client";

import { BarChart3, CircleUserRound, LayoutDashboard, LogIn, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OrganizerShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const dashboardActive = pathname === "/dashboard";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--line)]/80 bg-[var(--canvas)]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <Brand />
          <nav className="flex items-center gap-1" aria-label="Organizer navigation">
            <Link
              href="/dashboard"
              className={cn(
                "hidden min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold sm:flex",
                dashboardActive ? "bg-white" : "text-[var(--muted)] hover:bg-white/60",
              )}
            >
              <LayoutDashboard className="size-4" /> My surveys
            </Link>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/"><Plus className="size-4" /> New survey</Link>
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link href="/login" aria-label="Sign in"><CircleUserRound className="size-5" /></Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className={cn("mx-auto w-full px-5 py-8 sm:px-8 sm:py-12", wide ? "max-w-[1440px]" : "max-w-6xl")}>{children}</main>
      <nav className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-around rounded-full border border-[var(--line)] bg-[var(--paper)] p-2 shadow-xl sm:hidden" aria-label="Mobile organizer navigation">
        <Link href="/dashboard" className="flex min-h-11 flex-col items-center justify-center px-4 text-[10px] font-bold uppercase tracking-wide"><BarChart3 className="size-5" /> Surveys</Link>
        <Link href="/" className="grid size-12 place-items-center rounded-full bg-[var(--coral)]" aria-label="New survey"><Plus className="size-6" /></Link>
        <Link href="/login" className="flex min-h-11 flex-col items-center justify-center px-4 text-[10px] font-bold uppercase tracking-wide"><LogIn className="size-5" /> Sign in</Link>
      </nav>
    </div>
  );
}
