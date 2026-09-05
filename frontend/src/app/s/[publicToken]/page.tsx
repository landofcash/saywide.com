import type { Metadata } from "next";

import { WelcomeScreen } from "@/components/participant/welcome-screen";

export const metadata: Metadata = { title: "Share your perspective" };

export default async function PublicSurveyPage({ params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await params;
  return <WelcomeScreen publicToken={publicToken} />;
}
