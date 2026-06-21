// Copyright © 2026 Workforce. All rights reserved.
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LangModeApplier } from "@/components/layout/LangModeApplier";
import { IntroSplashGate } from "@/components/IntroSplashGate";

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
        <link rel="apple-touch-icon" href="/api/icon/180" />
        <link rel="apple-touch-icon" sizes="152x152" href="/api/icon/152" />
        <link rel="apple-touch-icon" sizes="167x167" href="/api/icon/167" />
        <link rel="apple-touch-icon" sizes="180x180" href="/api/icon/180" />
        <link rel="icon" type="image/png" sizes="32x32" href="/api/icon/32" />
        <link rel="icon" type="image/png" sizes="192x192" href="/api/icon/192" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <LangModeApplier />
        <IntroSplashGate />
        {children}
      </body>
    </html>
  );
}
