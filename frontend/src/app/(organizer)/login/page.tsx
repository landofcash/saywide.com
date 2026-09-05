import type { Metadata } from "next";

import { LoginScreen } from "@/components/organizer/account-screens";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() { return <LoginScreen />; }
