import { AppHeader } from "@/components/app-header";

export function OrganizerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader variant="organizer" />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-12">{children}</main>
    </div>
  );
}
