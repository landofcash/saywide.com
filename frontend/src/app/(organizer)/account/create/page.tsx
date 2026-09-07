import type { Metadata } from "next";

import { CreateAccountScreen } from "@/components/organizer/account-screens";
import { requireDemoMode } from "@/lib/require-demo-mode";

export const metadata: Metadata = { title: "Protect your surveys" };

export default function CreateAccountPage() {
  requireDemoMode();
  return <CreateAccountScreen />;
}
