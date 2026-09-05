import type { Metadata } from "next";

import { ReviewScreen } from "@/components/participant/review-screen";

export const metadata: Metadata = { title: "Review answers" };

export default async function ReviewPage({ params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await params;
  return <ReviewScreen publicToken={publicToken} />;
}
