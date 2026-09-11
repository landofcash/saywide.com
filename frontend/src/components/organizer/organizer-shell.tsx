import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";

export function OrganizerShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen">
      <AppHeader variant="organizer" />
      <main className={cn("mx-auto w-full px-4 py-6 sm:px-8 sm:py-12", wide ? "max-w-[1440px]" : "max-w-6xl")}>{children}</main>
    </div>
  );
}
