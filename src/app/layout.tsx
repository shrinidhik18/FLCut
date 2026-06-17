import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FLCut — Finite Loop's link shortener",
  description:
    "Short, smart, trackable links for every FLC event — hackathons, workshops, and talks.",
  openGraph: {
    title: "FLCut",
    description: "Link shortener built by Finite Loop Club.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-mesh min-h-screen antialiased">{children}</body>
    </html>
  );
}
