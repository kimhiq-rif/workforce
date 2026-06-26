"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CloudRain,
  FileText,
  MapPin,
  QrCode,
  Users,
  Wrench,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SiteStatusBadge, siteStatusColor } from "@/components/ui/SiteStatusBadge";
import { StageTargetSoftBlock, type SoftBlockSite } from "@/components/screens/Dashboard/StageTargetSoftBlock";
import type { Site, ProjectType } from "@/types/database";

type DashboardSite = Pick<
  Site,
  "id" | "name_th" | "name_en" | "location_th" | "location_en" | "status" | "photo_url" | "project_type"
> & {
  manager?: { name_th: string; name_en: string } | null;
};

interface TodayCalendarEvent {
  id: string;
  title: string;
  event_type: "task" | "meeting";
  event_time: string | null;
  is_done: boolean;
}

interface UpcomingCalendarEvent {
  id: string;
  title: string;
  event_type: "task" | "meeting";
  event_date: string;
  event_time: string | null;
}

interface AttendanceCount {
  site_id: string;
  status: string;
  wage_amount: number | null;
  arrival_time: string | null;
  worker: { name_th: string } | null;
}

interface DashboardClientProps {
  stageSoftBlock?: SoftBlockSite[];
  sites: DashboardSite[];
  attendanceCounts: AttendanceCount[];
  openReceiptsCount: number;
  pendingQrCount: number;
  pendingWageDecisions: { site_id: string }[];
  today: string;
  userProfile: { name_th?: string; name_en?: string } | null;
  todayEvents: TodayCalendarEvent[];
  upcomingEvents: UpcomingCalendarEvent[];
  overdueEvents: UpcomingCalendarEvent[];
}

export function DashboardClient({
  stageSoftBlock = [],
  sites,
  attendanceCounts,
  openReceiptsCount,
  pendingQrCount,
  pendingWageDecisions,
  today,
  userProfile,
  todayEvents,
  upcomingEvents,
  overdueEvents,
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
        {overdueEvents.map((ev) => (
          <Link key={ev.id} href="/calendar" className="attention-row">
            <span className="attention-icon red" style={{ fontSize: 18, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {ev.event_type === "meeting" ? "🤝" : "📋"}
            </span>
            <span style={{ flex: 1 }}>
              <strong style={{ fontSize: 14 }}>{ev.title}</strong>
              <small style={{ fontSize: 11, color: "#DC2626" }}>เลยกำหนด · Overdue</small>
            </span>
            <ChevronRight size={16} color="var(--text-muted)" />
          </Link>
        ))}
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

      <CalendarPanel upcoming={upcomingEvents} today={today} />
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
      <StageTargetSoftBlock sites={stageSoftBlock} />
      <div className="desktop-only">{mainContent}</div>
      <div className="mobile-only">
        <MobileDashboard
          sites={siteStats}
          openReceiptsCount={openReceiptsCount}
          pendingWageDecisions={pendingWageDecisions.length}
          liveSites={liveSites}
          totalReported={totalReported}
          totalExpected={totalExpected}
          todayEvents={todayEvents}
          upcomingEvents={upcomingEvents}
          overdueEvents={overdueEvents}
          today={today}
        />
      </div>
    </DashboardShell>
  );
}

function MobileDashboard({
  sites,
  openReceiptsCount,
  pendingWageDecisions,
  liveSites,
  totalReported,
  totalExpected,
  todayEvents,
  upcomingEvents,
  overdueEvents,
  today,
}: {
  sites: (DashboardSite & { reported: number; total: number; hasPendingWage: boolean; todayWorkers: AttendanceCount[] })[];
  openReceiptsCount: number;
  pendingWageDecisions: number;
  liveSites: number;
  totalReported: number;
  totalExpected: number;
  todayEvents: TodayCalendarEvent[];
  upcomingEvents: UpcomingCalendarEvent[];
  overdueEvents: UpcomingCalendarEvent[];
  today: string;
}) {
  const completedSites = sites.filter((site) => site.total > 0 && site.reported >= site.total).length;
  const rainSites = sites.filter((site) => site.status === "rain" || site.status === "day_off").length;
  const reviewSites = sites.filter((site) => site.status === "review" || site.hasPendingWage).length;
  const waitingSites = sites.filter((site) => site.status === "waiting").length;
  const criticalItems = pendingWageDecisions;
  const totalAlerts = openReceiptsCount + reviewSites + waitingSites + criticalItems;
  const recentUpdates = sites
    .flatMap((site) =>
      site.todayWorkers
        .filter((worker) => worker.arrival_time)
        .map((worker) => ({
          site,
          workerName: worker.worker?.name_th ?? "Worker",
          time: worker.arrival_time?.slice(0, 5) ?? "--:--",
        })),
    )
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 4);

  return (
    <div className="mobile-dashboard-v2">
      <header className="mobile-command-header">
        <div className="mobile-brand-lockup">
          <span className="mobile-brand-mark">W</span>
          <div>
            <strong>Workforce</strong>
            <small>Driven by Proof</small>
          </div>
        </div>
        <div className="mobile-header-actions">
          <span className="mobile-time-chip"><Clock3 size={13} /> Bangkok</span>
          <Link href="/calendar" className="mobile-icon-button" aria-label="Calendar & notifications">
            <Bell size={18} />
            {todayEvents.filter((e) => !e.is_done).length > 0 && (
              <span>{Math.min(todayEvents.filter((e) => !e.is_done).length, 9)}</span>
            )}
          </Link>
        </div>
      </header>

      <main className="mobile-command-content">
        <section className="mobile-today-panel">
          <div className="mobile-section-heading">
            <div>
              <h1>
                <span className="th-text">คำสั่งวันนี้</span>
                <span className="en-text block text-[12px] text-gray-400">Today command</span>
              </h1>
              <p>
                <span className="live-dot" />
                <span className="th-text">{liveSites} ไซต์ · {totalReported}/{totalExpected} รายงาน</span>
                <span className="en-text"> {liveSites} live · {totalReported}/{totalExpected} reported</span>
              </p>
            </div>
            <Link href="/sites" className="mobile-text-link">
              <span className="th-text">ไซต์</span>
              <span className="en-text">Sites</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="mobile-metric-grid">
            <MobileMetricTile value={sites.length}
              label={<><span className="th-text">ไซต์</span><span className="en-text">Sites</span></>}
              subLabel={<><span className="th-text">งานทั้งหมด</span><span className="en-text">All work</span></>}
              icon={<MapPin size={17} />} color="#1E3A8A" />
            <MobileMetricTile value={totalReported}
              label={<><span className="th-text">คนงาน</span><span className="en-text">Workers</span></>}
              subLabel={<><span className="th-text">จาก {totalExpected}</span><span className="en-text">of {totalExpected}</span></>}
              icon={<Users size={17} />} color="#06B6D4" />
            <MobileMetricTile value={completedSites}
              label={<><span className="th-text">เสร็จแล้ว</span><span className="en-text">Complete</span></>}
              subLabel={<><span className="th-text">ไซต์เสร็จ</span><span className="en-text">Sites done</span></>}
              icon={<CheckCircle2 size={17} />} color="#22C55E" />
            <MobileMetricTile value={totalAlerts}
              label={<><span className="th-text">แจ้งเตือน</span><span className="en-text">Alerts</span></>}
              subLabel={<><span className="th-text">ต้องดำเนินการ</span><span className="en-text">Need action</span></>}
              icon={<AlertCircle size={17} />} color="#FF6A00" />
          </div>
        </section>

        <section className="mobile-action-strip" aria-label="Quick actions">
          <Link href="/suppliers">
            <QrCode size={18} />
            <span><span className="th-text">สแกน</span><span className="en-text">Scan</span></span>
          </Link>
          <Link href="/sites">
            <MapPin size={18} />
            <span><span className="th-text">ไซต์</span><span className="en-text">Sites</span></span>
          </Link>
          <Link href="/workers">
            <Users size={18} />
            <span><span className="th-text">คนงาน</span><span className="en-text">Workers</span></span>
          </Link>
          <Link href="/reports">
            <FileText size={18} />
            <span><span className="th-text">รายงาน</span><span className="en-text">Reports</span></span>
          </Link>
        </section>

        <section className="mobile-signal-section">
          <div className="mobile-section-title">
            <strong><span className="th-text">สัญญาณสถานะ</span><span className="en-text">Status signals</span></strong>
            <small><span className="th-text">สีเป็นสัญญาณ</span><span className="en-text">Color-as-signal</span></small>
          </div>
          <div className="mobile-signal-grid">
            <MobileSignalCard icon={<Activity size={18} />}
              title={<><span className="th-text">กำลังทำงาน</span><span className="en-text">Live now</span></>}
              detail={<><span className="th-text">{liveSites} ไซต์</span><span className="en-text">{liveSites} active</span></>}
              color="#06B6D4" />
            <MobileSignalCard icon={<CheckCircle2 size={18} />}
              title={<><span className="th-text">เสร็จแล้ว</span><span className="en-text">Complete</span></>}
              detail={<><span className="th-text">{completedSites} ไซต์</span><span className="en-text">{completedSites} sites</span></>}
              color="#22C55E" />
            <MobileSignalCard icon={<CloudRain size={18} />}
              title={<><span className="th-text">ฝน / หยุด</span><span className="en-text">Rain / off</span></>}
              detail={<><span className="th-text">{rainSites} ไซต์</span><span className="en-text">{rainSites} sites</span></>}
              color="#3B82F6" />
            <MobileSignalCard icon={<AlertCircle size={18} />}
              title={<><span className="th-text">ต้องตรวจสอบ</span><span className="en-text">Needs check</span></>}
              detail={<><span className="th-text">{reviewSites + waitingSites} รายการ</span><span className="en-text">{reviewSites + waitingSites} items</span></>}
              color="#FF6A00" />
            <MobileSignalCard icon={<AlertTriangle size={18} />}
              title={<><span className="th-text">วิกฤต</span><span className="en-text">Critical</span></>}
              detail={<><span className="th-text">{criticalItems} การดำเนินการ</span><span className="en-text">{criticalItems} actions</span></>}
              color="#FF4444" />
            <MobileSignalCard icon={<FileText size={18} />}
              title={<><span className="th-text">ใบเสร็จ</span><span className="en-text">Receipts</span></>}
              detail={<><span className="th-text">{openReceiptsCount} รอดำเนินการ</span><span className="en-text">{openReceiptsCount} open</span></>}
              color="#8B5CF6" />
          </div>
        </section>

        <section className="mobile-panel">
          <div className="mobile-section-title">
            <strong><span className="th-text">อัพเดทล่าสุด</span><span className="en-text">Live updates</span></strong>
            <small><span className="th-text">วันนี้</span><span className="en-text">Today</span></small>
          </div>
          <div className="mobile-update-list">
            {recentUpdates.length > 0 ? (
              recentUpdates.map((update, index) => (
                <div className="mobile-update-row" key={`${update.site.id}-${update.time}-${index}`}>
                  <span className="mobile-update-time">{update.time}</span>
                  <span className="mobile-update-body">
                    <strong>{update.workerName}</strong>
                    <small>{update.site.name_en ?? update.site.name_th}</small>
                  </span>
                  <span className="mobile-update-status" style={{ color: siteStatusColor(update.site.status) }}>
                    <Activity size={16} />
                  </span>
                </div>
              ))
            ) : (
              <div className="mobile-empty-row">
                <span className="th-text">ยังไม่มีอัพเดท</span>
                <span className="en-text">No live updates yet</span>
              </div>
            )}
          </div>
        </section>

        <section className="mobile-panel">
          <div className="mobile-section-title">
            <strong>
              <span className="th-text">กิจกรรมวันนี้</span>
              <span className="en-text">Today&apos;s events</span>
            </strong>
            <Link href="/calendar" style={{ fontSize: 12, color: "var(--brand-primary)", fontWeight: 600 }}>
              Calendar <ChevronRight size={12} style={{ display: "inline" }} />
            </Link>
          </div>
          <div className="mobile-update-list">
            {todayEvents.length === 0 ? (
              <div className="mobile-empty-row">
                <span className="th-text">ไม่มีกิจกรรม</span>
                <span className="en-text">No events today</span>
              </div>
            ) : (
              todayEvents.map((ev) => (
                <Link key={ev.id} href="/calendar" className="mobile-update-row" style={{ textDecoration: "none", color: "inherit", opacity: ev.is_done ? 0.5 : 1 }}>
                  <span style={{ fontSize: 18 }}>{ev.event_type === "meeting" ? "🤝" : "📋"}</span>
                  <span className="mobile-update-body">
                    <strong style={{ textDecoration: ev.is_done ? "line-through" : "none" }}>{ev.title}</strong>
                    <small>{ev.event_time ? ev.event_time.slice(0, 5) : "All day"} · {ev.event_type === "meeting" ? "Meeting" : "Task"}</small>
                  </span>
                  {ev.is_done && <Check size={16} color="#22C55E" />}
                </Link>
              ))
            )}
          </div>
        </section>

        <CalendarPanel upcoming={upcomingEvents} overdueEvents={overdueEvents} today={today} showOverdue />
      </main>
    </div>
  );
}

function MobileMetricTile({
  value,
  label,
  subLabel,
  icon,
  color,
}: {
  value: number | string;
  label: React.ReactNode;
  subLabel: React.ReactNode;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="mobile-metric-tile">
      <span className="mobile-metric-icon" style={{ color, background: `${color}14` }}>
        {icon}
      </span>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{subLabel}</small>
    </div>
  );
}

function MobileSignalCard({
  icon,
  title,
  detail,
  color,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  detail: React.ReactNode;
  color: string;
}) {
  return (
    <div className="mobile-signal-card" style={{ borderLeftColor: color }}>
      <span className="mobile-signal-icon" style={{ color, background: `${color}14` }}>
        {icon}
      </span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </div>
  );
}

function daysUntil(eventDate: string, today: string): number {
  const t = new Date(today + "T00:00:00");
  const e = new Date(eventDate + "T00:00:00");
  return Math.round((e.getTime() - t.getTime()) / 86400000);
}

function countdownLabel(days: number): string {
  if (days === 0) return "วันนี้";
  if (days === 1) return "พรุ่งนี้";
  return `อีก ${days} วัน`;
}

function countdownColor(days: number): string {
  if (days === 0) return "#EF4444";
  if (days === 1) return "#F59E0B";
  return "#3B82F6";
}

function CalendarPanel({
  upcoming,
  overdueEvents = [],
  today,
  showOverdue = false,
}: {
  upcoming: UpcomingCalendarEvent[];
  overdueEvents?: UpcomingCalendarEvent[];
  today: string;
  showOverdue?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());
  const [localDeleted, setLocalDeleted] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const visible = upcoming.filter((e) => !localDeleted.has(e.id));

  async function markDone(id: string) {
    setBusy(id);
    await supabase.from("calendar_events").update({ is_done: true }).eq("id", id);
    setLocalDone((p) => { const s = new Set(p); s.add(id); return s; });
    setBusy(null);
  }

  async function deleteEvent(id: string) {
    if (!confirm("ลบกิจกรรมนี้? · Delete this event?")) return;
    setBusy(id);
    await supabase.from("calendar_events").delete().eq("id", id);
    setLocalDeleted((p) => { const s = new Set(p); s.add(id); return s; });
    setBusy(null);
    router.refresh();
  }

  function EventRow({ ev, overdue = false }: { ev: UpcomingCalendarEvent; overdue?: boolean }) {
    const days = overdue ? -1 : daysUntil(ev.event_date, today);
    const isDone = localDone.has(ev.id);
    const isExpanded = expandedId === ev.id;
    const isBusy = busy === ev.id;
    const color = overdue ? "#DC2626" : countdownColor(days);
    const icon = ev.event_type === "meeting" ? "🤝" : "📋";
    const timeStr = ev.event_time ? ev.event_time.slice(0, 5) : "All day";
    const chip = overdue ? "เลยกำหนด" : countdownLabel(days);

    return (
      <div
        style={{
          borderLeft: `3px solid ${color}`,
          marginBottom: 6,
          borderRadius: "0 6px 6px 0",
          background: isDone ? "#F9FAFB" : "var(--surface-2, #F8FAFC)",
          overflow: "hidden",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer" }}
          onClick={() => setExpandedId(isExpanded ? null : ev.id)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); if (!isDone && !isBusy) markDone(ev.id); }}
            style={{
              width: 20, height: 20, borderRadius: "50%",
              border: `2px solid ${isDone ? "#22C55E" : color}`,
              background: isDone ? "#22C55E" : "transparent",
              flexShrink: 0, cursor: isDone ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0, outline: "none",
            }}
            aria-label="Mark done"
          >
            {isDone && <Check size={10} color="white" />}
          </button>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong style={{
              fontSize: 13, display: "block",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              textDecoration: isDone ? "line-through" : "none",
              opacity: isDone ? 0.5 : 1,
            }}>
              {ev.title}
            </strong>
            <small style={{ fontSize: 11, color: "var(--text-muted)" }}>{timeStr}</small>
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, padding: "2px 6px", borderRadius: 8, flexShrink: 0 }}>
            {chip}
          </span>
        </div>
        {isExpanded && (
          <div style={{ padding: "0 12px 10px 44px", display: "flex", gap: 8 }}>
            <Link
              href="/calendar"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 12, color: "#1E3A8A", fontWeight: 600, padding: "4px 10px", border: "1px solid #BFDBFE", borderRadius: 6, textDecoration: "none" }}
            >
              Edit
            </Link>
            <button
              onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }}
              disabled={isBusy}
              style={{ fontSize: 12, color: "#EF4444", fontWeight: 600, padding: "4px 10px", border: "1px solid #FECACA", borderRadius: 6, background: "transparent", cursor: "pointer" }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  const hasContent = visible.length > 0 || (showOverdue && overdueEvents.length > 0);

  return (
    <section className="attention-card">
      <h2>กิจกรรมที่กำลังมา <span>Upcoming events</span></h2>
      {showOverdue && overdueEvents.map((ev) => <EventRow key={ev.id} ev={ev} overdue />)}
      {visible.length === 0 && !hasContent ? (
        <div style={{ padding: "12px 4px", color: "var(--text-muted)", fontSize: 13 }}>
          ไม่มีกิจกรรม · No upcoming events
        </div>
      ) : (
        visible.map((ev) => <EventRow key={ev.id} ev={ev} />)
      )}
      <Link href="/calendar" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 8, fontSize: 12, color: "#1E3A8A", fontWeight: 600, textDecoration: "none" }}>
        ดูปฏิทิน · Open calendar <ChevronRight size={12} />
      </Link>
    </section>
  );
}

function MobileSiteProgressRow({
  site,
}: {
  site: DashboardSite & { reported: number; total: number; hasPendingWage: boolean; todayWorkers: AttendanceCount[] };
}) {
  const color = siteStatusColor(site.status);
  const progress = site.total > 0 ? Math.min(100, Math.round((site.reported / site.total) * 100)) : 0;

  return (
    <Link href={`/sites/${site.id}`} className="mobile-site-progress-row" style={{ borderLeftColor: color }}>
      <div className="mobile-site-progress-main">
        <strong>{site.name_th}</strong>
        <small>{site.name_en}{site.location_en ? ` · ${site.location_en}` : ""}</small>
        <div className="mobile-progress-track">
          <span style={{ width: `${progress}%`, background: color }} />
        </div>
      </div>
      <div className="mobile-site-progress-side">
        <SiteStatusBadge status={site.status} small />
        <strong>{progress}%</strong>
        <small>{site.reported}/{site.total}</small>
      </div>
      <ChevronRight size={17} />
    </Link>
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
          <Image src={site.photo_url} alt={site.name_en ?? ""} fill style={{ objectFit: "cover" }} sizes="300px" />
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
function MobileDashboardLegacy({
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
