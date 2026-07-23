import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExcelAI",
  description: "AI-powered Excel automation and analysis platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
