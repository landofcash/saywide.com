import type { Metadata } from "next";

import { CreateReportScreen } from "@/components/organizer/create-report-screen";
import { requireDemoMode } from "@/lib/require-demo-mode";

export const metadata: Metadata = { title: "Create report" };

export default async function NewReportPage({ params }: { params: Promise<{ surveyId: string }> }) {
  requireDemoMode();
  const { surveyId } = await params;
  return <CreateReportScreen surveyId={surveyId} />;
}
