"use client";

import { ArrowLeft, ClipboardList, LogIn, LogOut, Menu, Plus, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { Brand } from "@/components/brand";
import { api, apiCapabilities } from "@/lib/api";
import { useOrganizerSession } from "@/components/organizer/organizer-session";
import { entryUrl, finishAccountAction } from "@/lib/organizer-navigation";

import styles from "./app-header.module.css";

export function AppHeader({ variant = "public" }: { variant?: "public" | "organizer" | "participant" | "access" }) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const open = openPath === pathname;
  const workspace = useOrganizerSession()?.session?.workspace;
  const creating = pathname === "/create" || pathname === "/surveys/new";
  const showNew = variant === "organizer" && !creating;
  const showSignIn = variant === "organizer" && apiCapabilities.accounts && workspace?.kind !== "registered";
  const hasSecondary = showNew || showSignIn;

  const secondaryLinks = <>
    {showNew && <Link href="/create" className={styles.secondary} onClick={() => setOpenPath(null)}><Plus aria-hidden="true" /> New survey</Link>}
    {showSignIn && <Link href={`${entryUrl(pathname)}#sign-in`} className={styles.secondary} onClick={() => setOpenPath(null)}><LogIn aria-hidden="true" /> Sign in</Link>}
  </>;

  return (
    <header className={styles.header} onKeyDown={(event) => {
      if (event.key === "Escape" && open) { setOpenPath(null); menuButton.current?.focus(); }
    }}>
      <div className={`${styles.inner} max-w-7xl`}>
        <Brand className={styles.brand} />
        {variant === "access" && <Link className={styles.secondary} href="/"><ArrowLeft aria-hidden="true" /> Back to home</Link>}
        {variant !== "participant" && variant !== "access" && <nav className={styles.navigation} aria-label="Main navigation">
          <div className={styles.desktopLinks}>{secondaryLinks}</div>
          <Link href={workspace?.kind === "registered" ? "/dashboard" : entryUrl()} className={styles.primary} aria-current={pathname === "/dashboard" ? "page" : undefined} onClick={() => setOpenPath(null)}>
            <ClipboardList aria-hidden="true" /> Dashboard
          </Link>
          {workspace?.kind === "registered" && <AccountMenu email={workspace.email} />}
          {hasSecondary && <button ref={menuButton} type="button" className={styles.menuButton} aria-label={open ? "Close navigation" : "More navigation"} aria-expanded={open} aria-controls="app-header-mobile-navigation" onClick={() => setOpenPath(open ? null : pathname)}>
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>}
        </nav>}
      </div>
      {variant !== "participant" && hasSecondary && open && <nav id="app-header-mobile-navigation" className={styles.mobileLinks} aria-label="Additional navigation">{secondaryLinks}</nav>}
    </header>
  );
}

function AccountMenu({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const details = useRef<HTMLDetailsElement>(null);
  async function logout() {
    setPending(true); setError("");
    try { await api.logout(); finishAccountAction("/"); }
    catch { setError("Couldn't sign out. Please try again."); setPending(false); }
  }
  return <details ref={details} className={styles.account} onKeyDown={(event) => {
    if (event.key === "Escape") { details.current?.removeAttribute("open"); details.current?.querySelector("summary")?.focus(); }
  }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) details.current?.removeAttribute("open"); }}>
    <summary aria-label={`Account: ${email}`}><UserRound aria-hidden="true" /><span>{email}</span></summary>
    <div className={styles.accountPanel}><p>{email}</p>
      <button disabled={pending} onClick={() => void logout()}><LogOut aria-hidden="true" />{pending ? "Signing out…" : "Sign out"}</button>
      {error && <p role="alert">{error}</p>}
    </div>
  </details>;
}
