"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Renders the 3-column desktop shell + mobile shell.

import { Sidebar } from "./Sidebar";
import { SystemBar } from "./SystemBar";
import { BottomNav } from "./BottomNav";

interface DashboardShellProps {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
  userInitials?: string;
  userName?: string;
  notificationCount?: number;
}

export function DashboardShell({
  children,
  rightPanel,
  userInitials = "SK",
  userName = "เจ้าของ",
  notificationCount = 0,
}: DashboardShellProps) {
  return (
    <>
      {/* ── Desktop 3-column ──────────────────────────────────────────── */}
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

      {/* ── Mobile vertical ───────────────────────────────────────────── */}
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
