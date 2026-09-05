import type { Metadata } from "next";

import { SurveyOverviewScreen } from "@/components/organizer/survey-overview-screen";

export const metadata: Metadata = { title: "Survey overview" };

export default async function SurveyOverviewPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params;
  return <SurveyOverviewScreen surveyId={surveyId} />;
}
