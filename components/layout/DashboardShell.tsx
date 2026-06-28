"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Renders the 3-column desktop shell + mobile shell.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { SystemBar } from "./SystemBar";
import { BottomNav } from "./BottomNav";
import { ActivityTracker } from "./ActivityTracker";

interface DashboardShellProps {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
  userInitials?: string;
  userName?: string;
  notificationCount?: number;
  driverMode?: boolean;
}

export function DashboardShell({
  children,
  rightPanel,
  userInitials = "SK",
  userName = "เจ้าของ",
  notificationCount = 0,
  driverMode = false,
}: DashboardShellProps) {
  if (driverMode) {
    return (
      <>
        <ActivityTracker />
        <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden", background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "white", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <Link href="/driver" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-primary)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
              <ArrowLeft size={18} />
              <span>กลับ · Back</span>
            </Link>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <ActivityTracker />
      <div
        className="desktop-only"
        style={{
          display: "grid",
          gridTemplateColumns: `220px 1fr ${rightPanel ? "300px" : "0"}`,
          height: "100dvh",
          overflow: "hidden",
        }}
      >
        <Sidebar />
        <div className="desktop-main">
          <SystemBar
            userInitials={userInitials}
            userName={userName}
            notificationCount={notificationCount}
          />
          <div className="main-scroll">{children}</div>
        </div>
        {rightPanel && <aside className="right-panel">{rightPanel}</aside>}
      </div>
      <div
        className="mobile-only"
        style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden", background: "var(--surface)" }}
      >
        <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
        <BottomNav />
      </div>
    </>
  );
}
