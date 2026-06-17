"use client";
// Copyright © 2026 Workforce. All rights reserved.

import Link from "next/link";
import { ChevronRight, FileText, QrCode, AlertCircle, Users } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SiteStatusBadge, siteStatusColor } from "@/components/ui/SiteStatusBadge";
import type { Site } from "@/types/database";

type DashboardSite = Pick<
  Site,
  "id" | "name_th" | "name_en" | "location_th" | "location_en" | "status"
> & {
  manager?: { name_th: string; name_en: string } | null;
};

interface AttendanceCount {
  site_id: string;
  status: string;
  wage_amount: number | null;
}

interface DashboardClientProps {
  sites: DashboardSite[];
  attendanceCounts: AttendanceCount[];
  openReceiptsCount: number;
  pendingQrCount: number;
  pendingWageDecisions: { site_id: string }[];
  today: string;
  userProfile: { name_th?: string; name_en?: string } | null;
}

export function DashboardClient({
  sites,
  attendanceCounts,
  openReceiptsCount,
  pendingQrCount,
  pendingWageDecisions,
  today,
  userProfile,
}: DashboardClientProps) {
  const initials = userProfile?.name_th
    ? userProfile.name_th.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "SK";

  // Build per-site attendance stats
  const siteStats = sites.map((site) => {
    const counts = attendanceCounts.filter((a) => a.site_id === site.id);
    const reported = counts.filter((a) => a.status !== "missing").length;
    const total = counts.length;
    const hasPendingWage = pendingWageDecisions.some((d) => d.site_id === site.id);
    return { ...site, reported, total, hasPendingWage };
  });

  const liveSites = siteStats.filter((s) => s.status === "live").length;
  const totalReported = siteStats.reduce((sum, s) => sum + s.reported, 0);
  const totalExpected = siteStats.reduce((sum, s) => sum + s.total, 0);
  const pendingItems = pendingWageDecisions.length + openReceiptsCount;

  // ── Right Panel ────────────────────────────────────────────────────────────
  const urgentSites = siteStats.filter(
    (s) => s.status === "review" || s.hasPendingWage || s.status === "rain"
  ).slice(0, 5);

  const rightPanel = (
    <>
      <section className="attention-card">
        <h2>
          สิ่งที่เจ้าของต้องดู
          <span>Owner attention</span>
        </h2>
        <Link href="/suppliers" className="attention-row">
          <span className="attention-icon orange"><FileText size={22} /></span>
          <span>
            <strong style={{ fontSize: 14 }}>ใบเสร็จรอดำเนินการ</strong>
            <small style={{ fontSize: 11, color: "var(--text-muted)" }}>Open receipts</small>
          </span>
          <b style={{ marginLeft: "auto", fontWeight: 700 }}>{openReceiptsCount}</b>
          <ChevronRight size={16} color="var(--text-muted)" />
        </Link>
        <Link href="/suppliers" className="attention-row">
          <span className="attention-icon blue"><QrCode size={22} /></span>
          <span>
            <strong style={{ fontSize: 14 }}>รอ QR จากคนขับ</strong>
            <small style={{ fontSize: 11, color: "var(--text-muted)" }}>Waiting for driver QR</small>
          </span>
          <b style={{ marginLeft: "auto", fontWeight: 700 }}>{pendingQrCount}</b>
          <ChevronRight size={16} color="var(--text-muted)" />
        </Link>
        {pendingWageDecisions.length > 0 && (
          <div className="attention-row" style={{ color: "#B91C1C" }}>
            <span className="attention-icon red"><AlertCircle size={22} /></span>
            <span>
              <strong style={{ fontSize: 14 }}>รอตัดสินค่าแรง</strong>
              <small style={{ fontSize: 11 }}>Wage decision pending</small>
            </span>
            <b style={{ marginLeft: "auto" }}>{pendingWageDecisions.length}</b>
          </div>
        )}
      </section>

      {urgentSites.length > 0 && (
        <section className="attention-card">
          <h2>ไซต์ที่ต้องดู <span>Sites needing attention</span></h2>
          {urgentSites.map((site) => (
            <Link key={site.id} href={`/sites/${site.id}`} className="attention-row">
              <span
                className="status-dot"
                style={{ background: siteStatusColor(site.status), flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>
                <strong style={{ fontSize: 14 }}>{site.name_th}</strong>
                <small style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>{site.name_en}</small>
              </span>
              <SiteStatusBadge status={site.status} small />
              <ChevronRight size={16} color="var(--text-muted)" />
            </Link>
          ))}
        </section>
      )}
    </>
  );

  // ── Main content (both desktop + mobile) ──────────────────────────────────
  const mainContent = (
    <>
      {/* Content header */}
      <div className="content-header">
        <div>
          <h1>
            ภาพรวมไซต์ทั้งหมด
            {liveSites > 0 && (
              <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 400, color: "#0E7490" }}>
                <span className="live-dot" style={{ marginRight: 4 }} />
                {liveSites} live
              </span>
            )}
          </h1>
          <p>All sites overview</p>
        </div>
        <div className="mini-stats-row" style={{ flex: 0 }}>
          <div className="mini-stat">
            <strong>{sites.length}</strong>
            <span>ไซต์</span>
            <small>Sites</small>
          </div>
          <div className="mini-stat">
            <strong>{totalReported}/{totalExpected}</strong>
            <span>รายงาน</span>
            <small>Reported</small>
          </div>
          <div className="mini-stat">
            <strong>{pendingItems}</strong>
            <span>รอดำเนินการ</span>
            <small>Pending</small>
          </div>
        </div>
      </div>

      {/* Sites grid */}
      {sites.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--text-muted)",
          }}
        >
          <Users size={48} strokeWidth={1.2} style={{ marginBottom: 16, opacity: 0.4 }} />
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>ยังไม่มีไซต์</p>
          <p style={{ fontSize: 14 }}>No sites yet — add your first site in Sites</p>
          <Link
            href="/sites"
            className="btn-primary"
            style={{ display: "inline-flex", marginTop: 16 }}
          >
            ไปที่ไซต์ · Go to Sites
          </Link>
        </div>
      ) : (
        <div className="site-grid">
          {siteStats.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}
    </>
  );

  return (
    <DashboardShell
      rightPanel={rightPanel}
      userInitials={initials}
      userName={userProfile?.name_th ?? "เจ้าของ"}
    >
      {/* Desktop: render inside DashboardShell's main scroll */}
      <div className="desktop-only">{mainContent}</div>

      {/* Mobile: full-width vertical layout */}
      <div className="mobile-only">
        <MobileDashboard
          sites={siteStats}
          openReceiptsCount={openReceiptsCount}
          pendingWageDecisions={pendingWageDecisions.length}
          liveSites={liveSites}
          totalReported={totalReported}
          totalExpected={totalExpected}
        />
      </div>
    </DashboardShell>
  );
}

// ── Site card (desktop) ──────────────────────────────────────────────────────
function SiteCard({ site }: { site: DashboardSite & { reported: number; total: number; hasPendingWage: boolean } }) {
  return (
    <Link
      href={`/sites/${site.id}`}
      className={`site-card ${site.status}`}
      style={{ display: "block", textDecoration: "none" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div className="site-card-name">{site.name_th}</div>
          <div className="site-card-sub">{site.name_en} · {site.location_en ?? ""}</div>
        </div>
        <SiteStatusBadge status={site.status} />
      </div>

      {site.manager && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}>
          ผู้จัดการ: {site.manager.name_th}
        </div>
      )}

      <div className="site-card-metrics">
        <div className="site-metric-item">
          <strong>{site.reported}/{site.total}</strong>
          <small>รายงาน</small>
        </div>
        <div className="site-metric-item">
          <strong>{site.hasPendingWage ? "⚠" : "✓"}</strong>
          <small>ค่าแรง</small>
        </div>
      </div>

      {site.hasPendingWage && (
        <div
          style={{
            marginTop: 10,
            padding: "6px 10px",
            background: "#FEF2F2",
            borderRadius: 6,
            fontSize: 12,
            color: "#B91C1C",
            fontWeight: 500,
          }}
        >
          รอตัดสินค่าแรง · Wage decision pending
        </div>
      )}
    </Link>
  );
}

// ── Mobile dashboard ─────────────────────────────────────────────────────────
function MobileDashboard({
  sites,
  openReceiptsCount,
  pendingWageDecisions,
  liveSites,
  totalReported,
  totalExpected,
}: {
  sites: (DashboardSite & { reported: number; total: number; hasPendingWage: boolean })[];
  openReceiptsCount: number;
  pendingWageDecisions: number;
  liveSites: number;
  totalReported: number;
  totalExpected: number;
}) {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Mobile header */}
      <div
        style={{
          background: "var(--brand-primary)",
          borderRadius: 12,
          padding: "16px",
          color: "white",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700 }}>แดชบอร์ด</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          <span className="live-dot" style={{ marginRight: 4 }} />
          {liveSites} live sites · All sites overview
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <div className="mini-stat">
          <strong>{sites.length}</strong>
          <span>ไซต์</span>
          <small>Sites</small>
        </div>
        <div className="mini-stat">
          <strong>{totalReported}/{totalExpected}</strong>
          <span>รายงาน</span>
          <small>Reported</small>
        </div>
        <div className="mini-stat">
          <strong>{openReceiptsCount}</strong>
          <span>ใบเสร็จ</span>
          <small>Receipts</small>
        </div>
      </div>

      {/* Attention row */}
      {(pendingWageDecisions > 0) && (
        <Link
          href="/reports"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 10,
            padding: "12px 14px",
            color: "#B91C1C",
            textDecoration: "none",
          }}
        >
          <AlertCircle size={20} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
            รอตัดสินค่าแรง {pendingWageDecisions} ไซต์
            <br />
            <small style={{ fontSize: 11, fontWeight: 400 }}>Wage decision pending</small>
          </span>
          <ChevronRight size={18} />
        </Link>
      )}

      {/* Sites list */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>ไซต์ทั้งหมด <small style={{ color: "var(--text-muted)", fontSize: 12 }}>All sites</small></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/sites/${site.id}`}
              className={`mobile-site-card ${site.status}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <span
                className="status-dot"
                style={{ background: siteStatusColor(site.status), flexShrink: 0, width: 10, height: 10 }}
              />
              <span style={{ flex: 1 }}>
                <strong style={{ display: "block", fontSize: 16 }}>{site.name_th}</strong>
                <small style={{ color: "var(--text-muted)", fontSize: 12 }}>{site.name_en} · {site.location_en}</small>
              </span>
              <div style={{ textAlign: "right" }}>
                <SiteStatusBadge status={site.status} small />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                  {site.reported}/{site.total} รายงาน
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-muted)" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
