import type { Metadata } from "next";

import { MarketingHomepage } from "@/components/marketing/marketing-homepage";

export const metadata: Metadata = {
  title: "Everyone has something to say",
  description:
    "Ask a question. AI builds the survey. Share the link. Your agent uncovers what matters most.",
};

export default function HomePage() {
  return <MarketingHomepage />;
}
