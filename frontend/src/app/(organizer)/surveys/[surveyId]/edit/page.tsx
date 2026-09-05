import type { Metadata } from "next";

import { SurveyBuilderScreen } from "@/components/organizer/survey-builder-screen";

export const metadata: Metadata = { title: "Edit survey" };

export default async function EditSurveyPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params;
  return <SurveyBuilderScreen surveyId={surveyId} />;
}
