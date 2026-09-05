import type { Metadata } from "next";

import { CreateReportScreen } from "@/components/organizer/create-report-screen";

export const metadata: Metadata = { title: "Create report" };

export default async function NewReportPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params;
  return <CreateReportScreen surveyId={surveyId} />;
}
