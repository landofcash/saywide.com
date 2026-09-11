import { Brand } from "@/components/brand";

export function ParticipantShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="mx-auto flex h-20 max-w-3xl items-center px-5 sm:px-8">
        <Brand />
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-5 sm:px-8 sm:pt-10">{children}</main>
    </div>
  );
}
