import type { Metadata } from "next";

import { CreateAccountScreen } from "@/components/organizer/account-screens";

export const metadata: Metadata = { title: "Protect your surveys" };

export default function CreateAccountPage() { return <CreateAccountScreen />; }
