import type { Metadata } from "next";

import { ClaimAccountScreen } from "@/components/organizer/account-screens";
import { requireDemoMode } from "@/lib/require-demo-mode";

export const metadata: Metadata = { title: "Claim guest surveys" };

export default function ClaimAccountPage() {
  requireDemoMode();
  return <ClaimAccountScreen />;
}
