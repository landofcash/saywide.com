import { notFound } from "next/navigation";

export function requireDemoMode(): void {
  if (process.env.NEXT_PUBLIC_USE_MOCK_API !== "true") notFound();
}
