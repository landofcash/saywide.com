import type { Metadata } from "next";

import { LoginScreen } from "@/components/organizer/account-screens";
import { requireDemoMode } from "@/lib/require-demo-mode";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  requireDemoMode();
  return <LoginScreen />;
}
