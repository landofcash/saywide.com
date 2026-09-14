"use client";

import type { OrganizerSession } from "@saywide/contracts";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { entryUrl } from "@/lib/organizer-navigation";
import { Button } from "@/components/ui/button";

interface SessionContext {
  session: OrganizerSession | null;
  error: string;
  refresh: () => Promise<void>;
}
const Context = createContext<SessionContext | null>(null);
export function useOrganizerSession() { return useContext(Context); }

export function OrganizerSessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<OrganizerSession | null>(null);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const next = await api.getSession();
      if (id === requestId.current) { setSession(next); setError(""); }
    } catch {
      if (id === requestId.current) setError("We couldn't check your session. Please try again.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const id = ++requestId.current;
    void api.getSession().then((next) => {
      if (!cancelled && id === requestId.current) { setSession(next); setError(""); }
    }).catch(() => {
      if (!cancelled && id === requestId.current) setError("We couldn't check your session. Please try again.");
    });
    return () => { cancelled = true; };
  }, [pathname]);
  useEffect(() => {
    const check = () => { void refresh(); };
    const visible = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener("focus", check);
    window.addEventListener("saywide:auth-expired", check);
    document.addEventListener("visibilitychange", visible);
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("saywide:account");
    if (channel) channel.onmessage = check;
    return () => {
      window.removeEventListener("focus", check);
      window.removeEventListener("saywide:auth-expired", check);
      document.removeEventListener("visibilitychange", visible);
      channel?.close();
    };
  }, [refresh]);

  return <Context.Provider value={{ session, error, refresh }}>
    <OrganizerRouteGate key={JSON.stringify([session?.workspace ?? null, session?.workspace?.kind === "registered" ? session.guestSurveyCount : 0])}>{children}</OrganizerRouteGate>
  </Context.Provider>;
}

function OrganizerRouteGate({ children }: { children: React.ReactNode }) {
  const context = useOrganizerSession()!;
  const pathname = usePathname();
  const router = useRouter();
  const protectedPage = /^\/(dashboard|create|surveys|reports)(\/|$)/.test(pathname);
  const needsEntry = protectedPage && context.session !== null && !context.session.workspace;
  useEffect(() => { if (needsEntry) router.replace(entryUrl(pathname)); }, [needsEntry, pathname, router]);
  if (protectedPage && (context.error || !context.session || needsEntry)) {
    return <main className="grid min-h-screen place-content-center gap-4 px-5 text-center">
      <p role="status">{context.error || "Opening your workspace…"}</p>
      {context.error && <Button variant="secondary" onClick={() => void context.refresh()}>Try again</Button>}
    </main>;
  }
  return children;
}
