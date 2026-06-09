import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio Radixs — Outreach",
  description: "Lokale-SEO-scan → outreach-email",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
