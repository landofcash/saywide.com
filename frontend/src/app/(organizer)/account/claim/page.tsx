import type { Metadata } from "next";

import { ClaimAccountScreen } from "@/components/organizer/account-screens";

export const metadata: Metadata = { title: "Claim guest surveys" };

export default function ClaimAccountPage() { return <ClaimAccountScreen />; }
