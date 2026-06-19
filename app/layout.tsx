// Copyright © 2026 Workforce. All rights reserved.
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LangModeApplier } from "@/components/layout/LangModeApplier";

export const metadata: Metadata = {
  title: "Workforce · Driven by Proof",
  description: "Construction site workforce management — Koh Samui, Thailand",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Workforce",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1E3A8A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <LangModeApplier />
        {children}
      </body>
    </html>
  );
}
