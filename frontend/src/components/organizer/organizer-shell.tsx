"use client";

import { CircleUserRound, LayoutDashboard, LogIn, Menu, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { apiCapabilities } from "@/lib/api";
import { cn } from "@/lib/utils";

export function OrganizerShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const dashboardActive = pathname === "/dashboard";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--paper)]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:h-20 sm:px-8">
          <Brand />
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Organizer navigation">
            <Link
              href="/dashboard"
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold",
                dashboardActive ? "bg-white" : "text-[var(--muted)] hover:bg-white/60",
              )}
            >
              <LayoutDashboard className="size-4" /> My surveys
            </Link>
            <Button asChild size="sm">
              <Link href="/create"><Plus className="size-4" /> New survey</Link>
            </Button>
            {apiCapabilities.accounts && <Button asChild variant="ghost" size="icon">
              <Link href="/login" aria-label="Sign in"><CircleUserRound className="size-5" /></Link>
            </Button>}
          </nav>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="sm:hidden"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-organizer-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
        {mobileMenuOpen && (
          <nav id="mobile-organizer-navigation" className="absolute inset-x-0 top-full border-b border-[var(--line)] bg-white shadow-lg sm:hidden" aria-label="Mobile organizer navigation">
            <div className="mx-auto max-w-[1440px] px-4 py-2">
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex min-h-12 items-center gap-3 border-b border-[var(--line)] px-2 text-sm font-semibold"><LayoutDashboard className="size-5 text-[var(--coral-dark)]" /> My surveys</Link>
              <Link href="/create" onClick={() => setMobileMenuOpen(false)} className="flex min-h-12 items-center gap-3 border-b border-[var(--line)] px-2 text-sm font-semibold"><Plus className="size-5 text-[var(--coral-dark)]" /> New survey</Link>
              {apiCapabilities.accounts && <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="flex min-h-12 items-center gap-3 px-2 text-sm font-semibold"><LogIn className="size-5 text-[var(--coral-dark)]" /> Sign in</Link>}
            </div>
          </nav>
        )}
      </header>
      <main className={cn("mx-auto w-full px-4 py-6 sm:px-8 sm:py-12", wide ? "max-w-[1440px]" : "max-w-6xl")}>{children}</main>
    </div>
  );
}
