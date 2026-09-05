import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Saywide — Listen at scale", template: "%s · Saywide" },
  description: "Create open-ended surveys and turn responses into evidence-backed reports.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
