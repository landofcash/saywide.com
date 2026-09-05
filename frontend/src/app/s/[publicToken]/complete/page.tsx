import type { Metadata } from "next";

import { CompleteScreen } from "@/components/participant/complete-screen";

export const metadata: Metadata = { title: "Response received" };

export default async function CompletePage({ params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await params;
  return <CompleteScreen publicToken={publicToken} />;
}
