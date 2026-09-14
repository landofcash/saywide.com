import type { Metadata } from "next";

import { CreateAccountScreen } from "@/components/organizer/account-screens";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Protect your surveys" };

export default function CreateAccountPage() {
  return <Suspense><CreateAccountScreen /></Suspense>;
}
