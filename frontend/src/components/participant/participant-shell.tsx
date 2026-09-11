import { AppHeader } from "@/components/app-header";

export function ParticipantShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <AppHeader variant="participant" />
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-5 sm:px-8 sm:pt-10">{children}</main>
    </div>
  );
}
