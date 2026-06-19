"use client";
// Copyright © 2026 Workforce. All rights reserved.

import Link from "next/link";
import { ChevronRight, FileText, QrCode, AlertCircle, Users, Wrench, Building2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SiteStatusBadge, siteStatusColor } from "@/components/ui/SiteStatusBadge";
import type { Site, ProjectType } from "@/types/database";

type DashboardSite = Pick<
  Site,
  "id" | "name_th" | "name_en" | "location_th" | "location_en" | "status" | "photo_url" | "project_type"
> & {
  manager?: { name_th: string; name_en: string } | null;
};

interface AttendanceCount {
  site_id: string;
  status: string;
  wage_amount: number | null;
  arrival_time: string | null;
  worker: { name_th: string } | null;
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

  const siteStats = sites.map((site) => {
    const counts = attendanceCounts.filter((a) => a.site_id === site.id);
    const reported = counts.filter((a) => a.status !== "missing").length;
    const total = counts.length;
    const hasPendingWage = pendingWageDecisions.some((d) => d.site_id === site.id);
    const todayWorkers = counts
      .filter((a) => a.status !== "missing" && a.arrival_time)
      .sort((a, b) => (a.arrival_time ?? "").localeCompare(b.arrival_time ?? ""));
    return { ...site, reported, total, hasPendingWage, todayWorkers };
  });

  const liveSites = siteStats.filter((s) => s.status === "live").length;
  const totalReported = siteStats.reduce((sum, s) => sum + s.reported, 0);
  const totalExpected = siteStats.reduce((sum, s) => sum + s.total, 0);
  const pendingItems = pendingWageDecisions.length + openReceiptsCount;

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

  const mainContent = (
    <>
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

      {sites.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <Users size={48} strokeWidth={1.2} style={{ marginBottom: 16, opacity: 0.4 }} />
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>ยังไม่มีไซต์</p>
          <p style={{ fontSize: 14 }}>No sites yet — add your first site in Sites</p>
          <Link href="/sites" className="btn-primary" style={{ display: "inline-flex", marginTop: 16 }}>
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
      <div className="desktop-only">{mainContent}</div>
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

// ── Status accent colors ──────────────────────────────────────────────────────
const ACCENT: Record<string, { bg: string; text: string; gradient: string }> = {
  live:     { bg: "#ECFEFF", text: "#0E7490", gradient: "linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%)" },
  finished: { bg: "#F0FDF4", text: "#15803D", gradient: "linear-gradient(135deg, #bbf7d0 0%, #86efac 100%)" },
  rain:     { bg: "#EFF6FF", text: "#1D4ED8", gradient: "linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)" },
  day_off:  { bg: "#EFF6FF", text: "#1D4ED8", gradient: "linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)" },
  review:   { bg: "#FFFBEB", text: "#B45309", gradient: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)" },
  waiting:  { bg: "#FFF7ED", text: "#C2410C", gradient: "linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)" },
  critical: { bg: "#FEF2F2", text: "#B91C1C", gradient: "linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)" },
  half_day: { bg: "#FFFBEB", text: "#B45309", gradient: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)" },
};

// ── Donut progress circle ─────────────────────────────────────────────────────
function DonutProgress({
  value,
  reported,
  total,
  color,
}: {
  value: number;
  reported: number;
  total: number;
  color: string;
}) {
  const size = 46;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>{reported}</span>
        <span style={{ fontSize: 8.5, color: "var(--text-muted)" }}>/{total}</span>
      </div>
    </div>
  );
}

// ── Worker avatar stack ───────────────────────────────────────────────────────
const AVATAR_COLORS = ["#3B82F6","#8B5CF6","#06B6D4","#F59E0B","#10B981","#EF4444"];

function AvatarStack({ count }: { count: number }) {
  const visible = Math.min(count, 3);
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {Array.from({ length: visible }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: AVATAR_COLORS[i % AVATAR_COLORS.length],
            border: "2px solid white",
            marginLeft: i > 0 ? -7 : 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 700,
            color: "white",
            flexShrink: 0,
          }}
        >
          {i + 1}
        </div>
      ))}
      {count > 3 && (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#E5E7EB",
            border: "2px solid white",
            marginLeft: -7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 700,
            color: "#6B7280",
            flexShrink: 0,
          }}
        >
          +{count - 3}
        </div>
      )}
    </div>
  );
}

// ── Site card (desktop) ───────────────────────────────────────────────────────
function SiteCard({
  site,
}: {
  site: DashboardSite & { reported: number; total: number; hasPendingWage: boolean; todayWorkers: AttendanceCount[] };
}) {
  const accent = ACCENT[site.status] ?? ACCENT.waiting;
  const isLong = site.project_type === "long";
  const statusColor = siteStatusColor(site.status);

  const MAX_VISIBLE = 5;
  const visibleWorkers = site.todayWorkers.slice(0, MAX_VISIBLE);
  const extraCount = site.todayWorkers.length > MAX_VISIBLE ? site.todayWorkers.length - MAX_VISIBLE : 0;

  return (
    <Link
      href={`/sites/${site.id}`}
      className={`site-card-photo${site.status === "live" ? " live" : ""}`}
      style={{ display: "block", borderTop: `3px solid ${statusColor}` }}
    >
      {/* Photo header / gradient header */}
      <div className="site-card-photo-header">
        {site.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={site.photo_url} alt={site.name_en ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div className="site-card-photo-bg" style={{ background: accent.gradient }} />
        )}
        <div className="site-card-photo-status">
          <SiteStatusBadge status={site.status} />
        </div>
        <div style={{
          position: "absolute", top: 8, left: 8,
          background: isLong ? "rgba(255,106,0,0.85)" : "rgba(124,58,237,0.8)",
          backdropFilter: "blur(4px)",
          borderRadius: 5, padding: "2px 7px",
          fontSize: 10, fontWeight: 700, color: "white",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          {isLong ? <Building2 size={10} /> : <Wrench size={10} />}
          {isLong ? "Long" : "Short"}
        </div>
      </div>

      {/* Card body */}
      <div className="site-card-photo-body">
        <div className="site-card-name">{site.name_th}</div>
        <div className="site-card-sub">
          {site.name_en}{site.location_en ? ` · ${site.location_en}` : ""}
        </div>

        {site.hasPendingWage && (
          <div style={{ marginTop: 6, padding: "3px 8px", background: "#FEF2F2", borderRadius: 5, fontSize: 11, color: "#B91C1C", fontWeight: 500, display: "inline-block" }}>
            รอตัดสินค่าแรง · Wage pending
          </div>
        )}

        {/* Worker strip */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          {visibleWorkers.length > 0 ? (
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              {visibleWorkers.map((w, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 38, maxWidth: 44 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                    color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {w.worker?.name_th?.[0] ?? "?"}
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-primary)", textAlign: "center", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {w.worker?.name_th?.split(" ")[0] ?? "-"}
                  </span>
                  <span style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center" }}>
                    {w.arrival_time ? w.arrival_time.slice(0, 5) : "–"}
                  </span>
                </div>
              ))}
              {extraCount > 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 38 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#E5E7EB", color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                    +{extraCount}
                  </div>
                </div>
              )}
              <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: statusColor }}>{site.reported}</div>
                <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>/{site.total} คน</div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>ยังไม่มีรายงาน · No reports yet</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{site.total} คน</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Mobile dashboard ──────────────────────────────────────────────────────────
function MobileDashboard({
  sites,
  openReceiptsCount,
  pendingWageDecisions,
  liveSites,
  totalReported,
  totalExpected,
}: {
  sites: (DashboardSite & { reported: number; total: number; hasPendingWage: boolean; todayWorkers: AttendanceCount[] })[];
  openReceiptsCount: number;
  pendingWageDecisions: number;
  liveSites: number;
  totalReported: number;
  totalExpected: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1>แดชบอร์ด</h1>
          <p>
            <span className="live-dot" style={{ marginRight: 4 }} />
            Dashboard · {liveSites} live
          </p>
        </div>
      </div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>

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

      {pendingWageDecisions > 0 && (
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

      <div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          ไซต์ทั้งหมด{" "}
          <small style={{ color: "var(--text-muted)", fontSize: 12 }}>All sites</small>
        </div>
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
                <strong className="cell-th" style={{ display: "block" }}>{site.name_th}</strong>
                <small className="cell-en">
                  {site.name_en} · {site.location_en}
                </small>
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
    </div>
  );
}
