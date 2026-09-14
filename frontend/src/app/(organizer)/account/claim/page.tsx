import type { Metadata } from "next";

import { ClaimAccountScreen } from "@/components/organizer/account-screens";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Claim guest surveys" };

export default function ClaimAccountPage() {
  return <Suspense><ClaimAccountScreen /></Suspense>;
}
