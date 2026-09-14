import { OrganizerSessionProvider } from "@/components/organizer/organizer-session";

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return <OrganizerSessionProvider>{children}</OrganizerSessionProvider>;
}
