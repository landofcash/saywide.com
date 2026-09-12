import { notFound } from "next/navigation";

import { ReportProgressPreview } from "@/components/organizer/report-progress-preview";

export default function ReportProgressPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ReportProgressPreview />;
}
