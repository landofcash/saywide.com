import type { Metadata } from "next";

import { ReportScreen } from "@/components/organizer/report-screen";

export const metadata: Metadata = { title: "Survey report" };

export default async function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return <ReportScreen reportId={reportId} />;
}
