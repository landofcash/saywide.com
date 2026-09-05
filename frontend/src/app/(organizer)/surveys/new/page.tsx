import type { Metadata } from "next";

import { SurveyBuilderScreen } from "@/components/organizer/survey-builder-screen";

export const metadata: Metadata = { title: "Build a survey" };

export default function NewSurveyPage() {
  return <SurveyBuilderScreen />;
}
