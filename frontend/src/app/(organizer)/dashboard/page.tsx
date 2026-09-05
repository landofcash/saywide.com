import type { Metadata } from "next";

import { DashboardScreen } from "@/components/organizer/dashboard-screen";

export const metadata: Metadata = { title: "My surveys" };

export default function DashboardPage() {
  return <DashboardScreen />;
}
