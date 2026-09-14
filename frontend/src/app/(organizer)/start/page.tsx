import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/components/organizer/account-screens";

export const metadata: Metadata = { title: "Get started", robots: { index: false, follow: false } };
export default function StartPage() { return <Suspense><LoginScreen /></Suspense>; }
