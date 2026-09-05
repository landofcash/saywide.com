import type { Metadata } from "next";

import { RespondScreen } from "@/components/participant/respond-screen";

export const metadata: Metadata = { title: "Answer survey" };

export default async function RespondPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicToken: string }>;
  searchParams: Promise<{ question?: string }>;
}) {
  const { publicToken } = await params;
  const { question } = await searchParams;
  const requestedQuestion = Number.parseInt(question ?? "1", 10);
  const initialQuestion = Number.isFinite(requestedQuestion) ? requestedQuestion : 1;
  return <RespondScreen publicToken={publicToken} initialQuestion={initialQuestion} />;
}
