import type { Metadata } from "next";

import { ReportScreen } from "@/components/organizer/report-screen";
import { requireDemoMode } from "@/lib/require-demo-mode";

export const metadata: Metadata = { title: "Survey report" };

export default async function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  requireDemoMode();
  const { reportId } = await params;
  return <ReportScreen reportId={reportId} />;
}
