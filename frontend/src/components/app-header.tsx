"use client";

import { ClipboardList, LogIn, Menu, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { Brand } from "@/components/brand";
import { apiCapabilities } from "@/lib/api";

import styles from "./app-header.module.css";

export function AppHeader({ variant = "public" }: { variant?: "public" | "organizer" | "participant" }) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const open = openPath === pathname;
  const creating = pathname === "/create" || pathname === "/surveys/new";
  const showNew = variant === "organizer" && !creating;
  const showSignIn = variant === "organizer" && apiCapabilities.accounts && pathname !== "/login";
  const hasSecondary = showNew || showSignIn;

  const secondaryLinks = <>
    {showNew && <Link href="/create" className={styles.secondary} onClick={() => setOpenPath(null)}><Plus aria-hidden="true" /> New survey</Link>}
    {showSignIn && <Link href="/login" className={styles.secondary} onClick={() => setOpenPath(null)}><LogIn aria-hidden="true" /> Sign in</Link>}
  </>;

  return (
    <header className={styles.header} onKeyDown={(event) => {
      if (event.key === "Escape" && open) { setOpenPath(null); menuButton.current?.focus(); }
    }}>
      <div className={styles.inner}>
        <Brand className={styles.brand} />
        {variant !== "participant" && <nav className={styles.navigation} aria-label="Main navigation">
          <div className={styles.desktopLinks}>{secondaryLinks}</div>
          <Link href="/dashboard" className={styles.primary} aria-current={pathname === "/dashboard" ? "page" : undefined} onClick={() => setOpenPath(null)}>
            <ClipboardList aria-hidden="true" /> My surveys
          </Link>
          {hasSecondary && <button ref={menuButton} type="button" className={styles.menuButton} aria-label={open ? "Close navigation" : "More navigation"} aria-expanded={open} aria-controls="app-header-mobile-navigation" onClick={() => setOpenPath(open ? null : pathname)}>
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>}
        </nav>}
      </div>
      {variant !== "participant" && hasSecondary && open && <nav id="app-header-mobile-navigation" className={styles.mobileLinks} aria-label="Additional navigation">{secondaryLinks}</nav>}
    </header>
  );
}
