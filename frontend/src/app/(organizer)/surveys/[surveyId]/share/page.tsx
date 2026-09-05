import type { Metadata } from "next";

import { ShareScreen } from "@/components/organizer/share-screen";

export const metadata: Metadata = { title: "Share survey" };

export default async function ShareSurveyPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params;
  return <ShareScreen surveyId={surveyId} />;
}
