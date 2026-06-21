"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SiteStatusBadge, siteStatusColor } from "@/components/ui/SiteStatusBadge";
import {
  ChevronLeft, ChevronRight, Camera, MapPin, CloudRain,
  Sun, Users, Clock, FileText, AlertTriangle, Check,
  UserCheck, Zap, UserPlus, X as XIcon, PlayCircle, Send, ImagePlus,
} from "lucide-react";
import { formatThaiDate, formatEnDate, formatCurrency, formatTime } from "@/lib/format";
import { computeAttendanceWageReason, computeWageAmount, canSetRainStatus, wageReasonLabel } from "@/lib/wage-logic";
import type { Site, AttendanceEvent, SiteDayStatusEvent, Worker } from "@/types/database";

type SiteWorker = Pick<
  Worker,
  "id" | "name_th" | "name_en" | "role_th" | "role_en" | "daily_wage" | "is_temporary" | "photo_url"
>;

interface SiteStage {
  id: string;
  name_th: string;
  name_en: string;
  color: string;
  position: number;
  is_current: boolean;
  started_at: string | null;
  completed_at: string | null;
  target_end_date: string | null;
}

interface SiteDetailClientProps {
  site: Site & { manager?: { id: string; name_th: string; name_en: string } | null };
  attendanceEvents: (AttendanceEvent & {
    worker?: { id: string; name_th: string; name_en: string; role_th: string | null; role_en: string | null; daily_wage: number; is_temporary: boolean; photo_url: string | null } | null;
  })[];
  dayStatus: SiteDayStatusEvent | null;
  workers: SiteWorker[];
  allWorkers: SiteWorker[];
  otherSites: { id: string; name_th: string; name_en: string; status: any }[];
  todayReceipts: any[];
  allTodayAttendance: { worker_id: string; site_id: string }[];
  yesterdayWorkerIds: string[];
  today: string;
  userId?: string;
  userRole?: string;
  stages?: SiteStage[];
}

export function SiteDetailClient({
  site,
  attendanceEvents,
  dayStatus,
  workers,
  allWorkers,
  otherSites,
  todayReceipts,
  allTodayAttendance,
  yesterdayWorkerIds,
  today,
  userId,
  userRole,
  stages = [],
}: SiteDetailClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [showCamera, setShowCamera] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<SiteWorker | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [toast, setToast] = useState("");
  const [rainModal, setRainModal] = useState(false);
  const [rainWageDecision, setRainWageDecision] = useState<string>("half_day");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [transferModal, setTransferModal] = useState<{ worker: SiteWorker; } | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [showReportFlow, setShowReportFlow] = useState(false);
  const [showSitePhotoCamera, setShowSitePhotoCamera] = useState(false);
  const [sitePhotoCapturing, setSitePhotoCapturing] = useState(false);

  // Move Stage
  const [moveStageModal, setMoveStageModal] = useState(false);
  const [moveStageNote, setMoveStageNote] = useState("");
  const [movingStage, setMovingStage] = useState(false);

  const currentStage = stages.find((s) => s.is_current) ?? null;
  const isLongProject = (site as any).project_type === "long";

  async function handleMoveStage() {
    if (!currentStage || movingStage) return;
    setMovingStage(true);
    try {
      const res = await fetch(`/api/sites/${site.id}/move-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transition_note: moveStageNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMoveStageModal(false);
      router.push(`/reports/stage/${data.stage_report_id}`);
    } catch (err: any) {
      showToast(err.message ?? "Error");
    } finally {
      setMovingStage(false);
    }
  }
  const sitePhotoVideoRef = useRef<HTMLVideoElement>(null);
  const sitePhotoStreamRef = useRef<MediaStream | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 5000);
  }

  // ── Site photo camera ───────────────────────────────────────────────────────
  async function openSitePhotoCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      sitePhotoStreamRef.current = stream;
      setShowSitePhotoCamera(true);
    } catch {
      showToast("ไม่สามารถเปิดกล้องได้ · Camera access denied");
    }
  }

  function closeSitePhotoCamera() {
    sitePhotoStreamRef.current?.getTracks().forEach((t) => t.stop());
    sitePhotoStreamRef.current = null;
    setShowSitePhotoCamera(false);
  }

  async function captureSitePhoto() {
    if (!sitePhotoVideoRef.current) return;
    setSitePhotoCapturing(true);

    const canvas = document.createElement("canvas");
    canvas.width = sitePhotoVideoRef.current.videoWidth || 1280;
    canvas.height = sitePhotoVideoRef.current.videoHeight || 720;
    canvas.getContext("2d")!.drawImage(sitePhotoVideoRef.current, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) {
      showToast("กล้องยังไม่พร้อม · Camera not ready");
      setSitePhotoCapturing(false);
      return;
    }

    const fileName = `sites/${site.id}/photo_${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("site-photos")
      .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      showToast("อัพโหลดไม่สำเร็จ · Upload failed: " + uploadError.message);
      setSitePhotoCapturing(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(fileName);
    const photoUrl = urlData?.publicUrl;

    const { error: dbError } = await supabase.from("sites").update({ photo_url: photoUrl }).eq("id", site.id);

    setSitePhotoCapturing(false);
    closeSitePhotoCamera();

    if (dbError) {
      showToast("บันทึกไม่สำเร็จ · Save failed");
      return;
    }

    showToast("✓ อัพเดทรูปไซต์แล้ว · Site photo updated");
    router.refresh();
  }

  const reported = attendanceEvents.filter((e) => e.status !== "missing").length;
  const onSite = attendanceEvents.filter((e) => e.status === "on_site").length;
  const late = attendanceEvents.filter((e) => e.is_late).length;
  const totalWage = attendanceEvents.reduce((sum, e) => sum + (e.wage_amount ?? 0), 0);

  // ── Transfer worker to another site (owner only) ───────────────────────────
  async function handleTransfer(worker: SiteWorker, targetSiteId: string) {
    setTransferring(true);
    const { error } = await supabase
      .from("workers")
      .update({ assigned_site_id: targetSiteId })
      .eq("id", worker.id);
    setTransferring(false);
    if (error) { showToast("Error transferring · " + error.message); return; }
    const target = otherSites.find((s) => s.id === targetSiteId);
    showToast(`✓ ${worker.name_th} → ${target?.name_th ?? "ไซต์อื่น"}`);
    setTransferModal(null);
    router.refresh();
  }

  // ── Camera / GPS attendance ─────────────────────────────────────────────────
  async function startCamera(worker: SiteWorker) {
    setSelectedWorker(worker);
    setShowCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      showToast("ไม่สามารถเปิดกล้องได้ · Camera access denied");
      setShowCamera(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
    setSelectedWorker(null);
  }

  async function capturePhoto() {
    if (!videoRef.current || !selectedWorker) return;
    setCapturing(true);

    // Capture frame from video
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(videoRef.current, 0, 0);

    // Get GPS
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      // GPS optional
    }

    // Upload photo to Supabase storage
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve as any, "image/jpeg", 0.85));
    const fileName = `attendance/${site.id}/${today}/${selectedWorker.id}_${Date.now()}.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("attendance-photos")
      .upload(fileName, blob, { contentType: "image/jpeg", upsert: false });

    let photoUrl: string | null = null;
    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage
        .from("attendance-photos")
        .getPublicUrl(fileName);
      photoUrl = urlData?.publicUrl ?? null;
    }

    // Bangkok time
    const now = new Date();
    const bangkokTime = now.toLocaleTimeString("en-US", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const wageReason = computeAttendanceWageReason(bangkokTime, site.status as any);
    const wageAmount = wageReason
      ? computeWageAmount(selectedWorker.daily_wage, wageReason)
      : 0;

    const workdayStart = "08:00";
    const isLate = bangkokTime > workdayStart;

    // Save attendance event
    const { error: dbError } = await supabase
      .from("attendance_events")
      .upsert(
        {
          owner_id: site.owner_id,
          site_id: site.id,
          worker_id: selectedWorker.id,
          reported_by: userId,
          event_date: today,
          arrival_time: bangkokTime,
          photo_url: photoUrl,
          photo_lat: lat,
          photo_lng: lng,
          status: isLate ? "late" : "on_site",
          is_late: isLate,
          wage_reason: wageReason,
          wage_amount: wageAmount,
        },
        { onConflict: "worker_id,event_date,site_id" }
      );

    setCapturing(false);
    stopCamera();

    if (dbError) {
      showToast("เกิดข้อผิดพลาด · Error saving attendance");
      return;
    }

    // Auto-assign worker to this site (photo = assignment)
    await supabase
      .from("workers")
      .update({ assigned_site_id: site.id })
      .eq("id", selectedWorker.id);

    // First check-in of the day → site goes live
    if (reported === 0) {
      await supabase
        .from("site_day_status_events")
        .upsert({
          owner_id: site.owner_id,
          site_id: site.id,
          event_date: today,
          status: "live",
          set_by: userId,
          set_at: new Date().toISOString(),
          set_before_attendance: false,
          wage_decision: "full_day",
          wage_reason: "full_day",
          attendance_count_at_change: 0,
        }, { onConflict: "site_id,event_date" });
      await supabase.from("sites").update({ status: "live" }).eq("id", site.id);
    }

    showToast(
      `✓ บันทึก ${selectedWorker.name_th} เวลา ${bangkokTime}${isLate ? " (สาย)" : ""}`
    );
    router.refresh();
  }

  // ── Rain modal ──────────────────────────────────────────────────────────────
  const nowBangkok = new Date().toLocaleTimeString("en-US", {
    timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const rainStatus = canSetRainStatus(nowBangkok);

  async function handleRainConfirm() {
    if (rainStatus === "blocked") {
      showToast("Too late to change day status · เกิน 13:00 แล้ว");
      return;
    }

    const { error } = await supabase
      .from("site_day_status_events")
      .upsert({
        owner_id: site.owner_id,
        site_id: site.id,
        event_date: today,
        status: "rain",
        set_by: userId,
        set_at: new Date().toISOString(),
        set_before_attendance: reported === 0,
        wage_decision: rainWageDecision,
        wage_reason: rainWageDecision === "half_day" ? "half_day_rain"
          : rainWageDecision === "none" ? "no_pay_rain_before_attendance"
          : "pending_owner_decision",
        attendance_count_at_change: reported,
      });

    setRainModal(false);

    if (error) {
      showToast("เกิดข้อผิดพลาด · Error setting rain status");
      return;
    }

    // Update site status
    await supabase
      .from("sites")
      .update({ status: "rain" })
      .eq("id", site.id);

    showToast("บันทึกวันฝนแล้ว · Rain day recorded");
    router.refresh();
  }

  // ── Right panel ─────────────────────────────────────────────────────────────
  const rightPanel = (
    <>
      <section className="attention-card">
        <h2>สรุปไซต์วันนี้ <span>Site summary</span></h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>รายงานแล้ว · Reported</span>
            <strong>{reported}/{workers.length}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>กำลังทำงาน · On site</span>
            <strong style={{ color: "#22C55E" }}>{onSite}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>มาสาย · Late</span>
            <strong style={{ color: "#F97316" }}>{late}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
            <span style={{ color: "var(--text-muted)" }}>ค่าแรงวันนี้ · Today wages</span>
            <strong>฿{formatCurrency(totalWage)}</strong>
          </div>
        </div>
      </section>

      {otherSites.length > 0 && (
        <section className="attention-card">
          <h2>ไซต์อื่น <span>Other sites</span></h2>
          {otherSites.slice(0, 5).map((s) => (
            <Link key={s.id} href={`/sites/${s.id}`} className="attention-row">
              <span className="status-dot" style={{ background: siteStatusColor(s.status) }} />
              <span style={{ flex: 1 }}>
                <strong style={{ fontSize: 14 }}>{s.name_th}</strong>
                <small style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>{s.name_en}</small>
              </span>
              <SiteStatusBadge status={s.status} small />
              <ChevronRight size={16} color="var(--text-muted)" />
            </Link>
          ))}
        </section>
      )}

      {todayReceipts.length > 0 && (
        <section className="attention-card">
          <h2>ใบเสร็จวันนี้ <span>Today receipts</span></h2>
          {todayReceipts.slice(0, 3).map((r: any) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 14 }}>
              <span>{r.supplier?.name_th ?? "ไม่ระบุ"}</span>
              <strong>฿{formatCurrency(r.amount ?? 0)}</strong>
            </div>
          ))}
        </section>
      )}
    </>
  );

  // ── Main content ────────────────────────────────────────────────────────────
  const mainContent = (
    <>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <Link
            href="/sites"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: 13, textDecoration: "none", marginBottom: 6 }}
          >
            <ChevronLeft size={16} /> กลับ · Back to Sites
          </Link>
          <h1 style={{ fontSize: 31, fontWeight: 700, marginBottom: 2, display: "flex", alignItems: "center", gap: 10 }}>
            {site.name_th}
            {site.status === "live" && <span className="live-dot" />}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{site.name_en} · Site detail</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <SiteStatusBadge status={site.status as any} />
          {(userRole === "owner" || userRole === "field_manager" || userRole === "technical_admin") && (
            <button
              className="btn-primary"
              style={{ background: "#8B5CF6" }}
              onClick={openSitePhotoCamera}
            >
              <ImagePlus size={18} />
              เปลี่ยนรูป · Update photo
            </button>
          )}
          {rainStatus !== "blocked" && (
            <button
              className="btn-primary"
              style={{ background: "#3B82F6" }}
              onClick={() => setRainModal(true)}
            >
              <CloudRain size={18} />
              ฝน · Rain
            </button>
          )}
          {userRole === "owner" && isLongProject && currentStage && (
            <button
              className="btn-primary"
              style={{ background: "#6C5CE7" }}
              onClick={() => { setMoveStageNote(""); setMoveStageModal(true); }}
            >
              <Zap size={18} />
              ย้ายขั้นตอน · Move Stage
            </button>
          )}
        </div>
      </div>

      {/* Day status warning */}
      {dayStatus && dayStatus.wage_decision === "pending" && (
        <div style={{
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "#B91C1C",
        }}>
          <AlertTriangle size={20} />
          <div>
            <strong style={{ fontSize: 15 }}>รอตัดสินค่าแรง · Wage decision pending</strong>
            <div style={{ fontSize: 13 }}>รายงานประจำวันถูกบล็อก · Daily report blocked</div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
        <div className="metric-card blue">
          <div className="metric-icon blue"><Users size={28} strokeWidth={1.8} /></div>
          <div className="metric-label"><strong>รายงานแล้ว</strong><small>Reported</small></div>
          <div className="metric-value">{reported}<small>/{workers.length}</small></div>
        </div>
        <div className="metric-card green">
          <div className="metric-icon green"><UserCheck size={28} strokeWidth={1.8} /></div>
          <div className="metric-label"><strong>กำลังทำงาน</strong><small>On site</small></div>
          <div className="metric-value" style={{ color: "#22C55E" }}>{onSite}</div>
        </div>
        <div className="metric-card orange">
          <div className="metric-icon orange"><Clock size={28} strokeWidth={1.8} /></div>
          <div className="metric-label"><strong>มาสาย</strong><small>Late</small></div>
          <div className="metric-value" style={{ color: "#F97316" }}>{late}</div>
        </div>
        <div className="metric-card teal">
          <div className="metric-icon teal"><Zap size={28} strokeWidth={1.8} /></div>
          <div className="metric-label"><strong>ค่าแรงวันนี้</strong><small>Today wages</small></div>
          <div className="metric-value" style={{ fontSize: 18 }}>฿{formatCurrency(totalWage)}</div>
        </div>
      </div>

      {/* Attendance table */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontSize: 19, fontWeight: 600 }}>
            การรายงานวันนี้
            <span style={{ display: "block", fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Attendance today · {formatThaiDate(today)} · {formatEnDate(today)}</span>
          </h2>
          <button
            className="btn-primary"
            style={{ gap: 8 }}
            onClick={() => workers.length ? startCamera(workers[0]) : showToast("ไม่มีพนักงานในไซต์")}
          >
            <Camera size={18} />
            ถ่ายภาพ · Check-in
          </button>
        </div>

        <div className="table-card">
          <div
            className="table-header"
            style={{ gridTemplateColumns: "2fr 100px 120px 120px 110px" }}
          >
            <span>พนักงาน <small>Worker</small></span>
            <span>เวลาเข้า <small>Arrival</small></span>
            <span>สถานะ <small>Status</small></span>
            <span>ค่าแรง <small>Wage reason</small></span>
            <span>ยอด <small>Amount</small></span>
          </div>

          {workers.length === 0 ? (
            <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
              ยังไม่มีพนักงานในไซต์ · No workers assigned
              <br />
              <Link href="/workers" style={{ color: "var(--brand-primary)", fontSize: 13 }}>
                ไปที่ Workers → เพิ่มพนักงาน
              </Link>
            </div>
          ) : (
            workers.map((worker) => {
              const event = attendanceEvents.find((e) => e.worker_id === worker.id);
              const wageLabel = wageReasonLabel(event?.wage_reason ?? null);
              return (
                <Link
                  key={worker.id}
                  href={`/workers/${worker.id}`}
                  className="table-row"
                  style={{ gridTemplateColumns: "2fr 100px 120px 120px 110px", display: "grid", padding: "12px 20px", gap: 12, textDecoration: "none", color: "inherit" }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="avatar" style={{ width: 34, height: 34, fontSize: 11, flexShrink: 0 }}>
                      {worker.name_th[0]}
                    </div>
                    <span>
                      <span className="cell-th">{worker.name_th}</span>
                      <span className="cell-en">{worker.name_en}</span>
                      {worker.is_temporary && (
                        <span style={{
                          display: "inline-block",
                          marginTop: 2,
                          background: "#FFF7ED",
                          color: "#C2410C",
                          borderRadius: 4,
                          padding: "1px 6px",
                          fontSize: 10,
                          fontWeight: 600,
                        }}>
                          Temporary · ชั่วคราว
                        </span>
                      )}
                    </span>
                  </span>

                  <span style={{ fontSize: 15, fontWeight: 600, color: event ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {event?.arrival_time ? formatTime(event.arrival_time) : "-"}
                  </span>

                  <span>
                    {event ? (
                      <AttendanceStatusBadge status={event.status} isLate={event.is_late} />
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>ยังไม่รายงาน · Not yet</span>
                    )}
                  </span>

                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {event?.wage_reason ? wageLabel.th : "-"}
                  </span>

                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {event?.wage_amount != null ? (
                      <strong style={{ fontSize: 15, color: event.wage_amount > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                        ฿{formatCurrency(event.wage_amount)}
                      </strong>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>-</span>
                    )}
                    {!event && (
                      <button
                        onClick={(e) => { e.preventDefault(); startCamera(worker); }}
                        className="btn-primary"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                      >
                        <Camera size={14} /> ถ่าย
                      </button>
                    )}
                    {userRole === "owner" && otherSites.length > 0 && (
                      <button
                        onClick={(e) => { e.preventDefault(); setTransferModal({ worker }); }}
                        title="ย้ายไปไซต์อื่น · Transfer"
                        style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 6px", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--text-muted)" }}
                      >
                        <UserPlus size={13} />
                      </button>
                    )}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      <DashboardShell rightPanel={rightPanel}>
        <div className="desktop-only">{mainContent}</div>
        <div className="mobile-only">
          <MobileSiteDetail
            site={site}
            workers={workers}
            attendanceEvents={attendanceEvents}
            reported={reported}
            totalWage={totalWage}
            late={late}
            onCheckIn={startCamera}
            onStartReport={() => setShowReportFlow(true)}
            onRain={() => setRainModal(true)}
            onTransfer={(w) => setTransferModal({ worker: w })}
            onUpdateSitePhoto={openSitePhotoCamera}
            onMoveStage={() => { setMoveStageNote(""); setMoveStageModal(true); }}
            currentStage={currentStage}
            rainStatus={rainStatus}
            today={today}
            userRole={userRole}
          />
        </div>
      </DashboardShell>

      {/* Mobile attendance report flow overlay */}
      {showReportFlow && (
        <AttendanceReportFlow
          site={site}
          allWorkers={allWorkers}
          attendanceEvents={attendanceEvents}
          allTodayAttendance={allTodayAttendance}
          yesterdayWorkerIds={yesterdayWorkerIds}
          otherSites={otherSites}
          today={today}
          userId={userId}
          onClose={() => setShowReportFlow(false)}
          onDone={() => {
            setShowReportFlow(false);
            router.refresh();
          }}
          showToast={showToast}
        />
      )}

      {/* Camera overlay */}
      {showCamera && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.95)",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ color: "white", padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>ถ่ายภาพ Check-in</div>
            <div style={{ fontSize: 14, opacity: 0.75, marginTop: 4 }}>
              {selectedWorker?.name_th} · {selectedWorker?.name_en}
            </div>
          </div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: "100%", maxWidth: 480, flex: 1, objectFit: "cover" }}
          />
          <div style={{ padding: "20px 16px", display: "flex", gap: 16 }}>
            <button
              onClick={stopCamera}
              className="btn-primary"
              style={{ background: "rgba(255,255,255,0.15)", flex: 1 }}
            >
              ยกเลิก · Cancel
            </button>
            <button
              onClick={capturePhoto}
              disabled={capturing}
              className="btn-primary"
              style={{ flex: 2, justifyContent: "center" }}
            >
              <Camera size={20} />
              {capturing ? "กำลังบันทึก…" : "ถ่ายภาพ · Capture"}
            </button>
          </div>

          {/* Worker selector — shows ALL active workers so new arrivals can be checked in */}
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              padding: "0 16px 20px",
              display: "flex",
              gap: 8,
              overflowX: "auto",
            }}
          >
            {allWorkers.map((w) => {
              const isAssigned = workers.some((aw) => aw.id === w.id);
              return (
                <button
                  key={w.id}
                  onClick={() => setSelectedWorker(w)}
                  style={{
                    flexShrink: 0,
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: `1px solid ${isAssigned ? "rgba(255,255,255,0.6)" : "rgba(255,165,0,0.7)"}`,
                    background: selectedWorker?.id === w.id ? "white" : "transparent",
                    color: selectedWorker?.id === w.id ? "var(--brand-primary)" : "white",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    opacity: isAssigned ? 1 : 0.75,
                  }}
                >
                  {w.name_th}
                  {!isAssigned && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>✦</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Transfer worker modal (owner only) */}
      {transferModal && (
        <TransferWorkerModal
          worker={transferModal.worker}
          targetSites={otherSites}
          onTransfer={(siteId) => handleTransfer(transferModal.worker, siteId)}
          onClose={() => setTransferModal(null)}
          transferring={transferring}
        />
      )}

      {/* Site photo camera overlay */}
      {showSitePhotoCamera && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.97)",
            zIndex: 1001,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ color: "white", padding: "20px 16px", textAlign: "center", width: "100%" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>เปลี่ยนรูปไซต์ · Update Site Photo</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{site.name_th}</div>
          </div>
          <video
            ref={(el) => {
              (sitePhotoVideoRef as any).current = el;
              if (el && sitePhotoStreamRef.current) el.srcObject = sitePhotoStreamRef.current;
            }}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", maxWidth: 520, flex: 1, objectFit: "cover" }}
          />
          <div style={{ padding: "20px 16px", display: "flex", gap: 12, width: "100%", maxWidth: 520 }}>
            <button
              onClick={closeSitePhotoCamera}
              className="btn-primary"
              style={{ background: "rgba(255,255,255,0.15)", flex: 1, justifyContent: "center" }}
            >
              ยกเลิก · Cancel
            </button>
            <button
              onClick={captureSitePhoto}
              disabled={sitePhotoCapturing}
              className="btn-primary"
              style={{ flex: 2, justifyContent: "center" }}
            >
              <Camera size={20} />
              {sitePhotoCapturing ? "กำลังบันทึก…" : "ถ่ายภาพ · Capture"}
            </button>
          </div>
        </div>
      )}

      {/* Move Stage modal */}
      {moveStageModal && currentStage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 440 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>🚀</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1E3A8A", marginBottom: 4 }}>
                ย้ายขั้นตอน
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Move Stage</p>
            </div>

            {/* Current stage */}
            <div style={{ background: "#F2F4FF", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: currentStage.color, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#1E3A8A" }}>{currentStage.name_th}</p>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{currentStage.name_en} → จะถูกปิด / will be closed</p>
              </div>
            </div>

            {/* Next stage preview */}
            {(() => {
              const next = stages.find((s) => !s.is_current && !s.completed_at);
              if (!next) return (
                <div style={{ background: "#FEF2F2", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: "#991B1B" }}>
                  ⚠️ ไม่มีขั้นตอนถัดไป · No next stage defined
                </div>
              );
              return (
                <div style={{ background: "#F0FDF4", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: next.color, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#166534" }}>{next.name_th}</p>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{next.name_en} → จะเปิด / will activate</p>
                  </div>
                </div>
              );
            })()}

            {/* Optional note */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                หมายเหตุ · Note (optional)
              </label>
              <textarea
                value={moveStageNote}
                onChange={(e) => setMoveStageNote(e.target.value)}
                rows={2}
                placeholder="เช่น งานฐานรากเสร็จแล้ว · e.g. Foundation complete"
                style={{ width: "100%", borderRadius: 10, border: "1px solid #D1D5DB", padding: "10px 12px", fontSize: 14, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setMoveStageModal(false)}
                style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #D1D5DB", background: "white", fontSize: 15, cursor: "pointer" }}
              >
                ยกเลิก · Cancel
              </button>
              <button
                onClick={handleMoveStage}
                disabled={movingStage}
                style={{ flex: 2, padding: "12px 0", borderRadius: 10, background: "#6C5CE7", color: "white", fontSize: 15, fontWeight: 600, border: "none", cursor: movingStage ? "not-allowed" : "pointer", opacity: movingStage ? 0.7 : 1 }}
              >
                {movingStage ? "กำลังประมวลผล…" : "🚀 ย้ายขั้นตอน · Move Stage"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rain modal */}
      {rainModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: "28px 24px",
              width: "100%",
              maxWidth: 420,
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 40 }}>🌧</div>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>ฝนหยุดงาน</h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                Rain / Day off · {site.name_th}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                มีพนักงานรายงานแล้ว {reported} คน · {reported} workers reported
              </p>
            </div>

            {rainStatus === "blocked" ? (
              <div style={{ background: "#FEF2F2", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#B91C1C", fontSize: 14 }}>
                เกิน 13:00 แล้ว ไม่สามารถเปลี่ยนสถานะได้ · Too late to change day status (after 13:00)
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>ค่าแรงสำหรับพนักงานที่รายงานแล้ว · Wage for reported workers:</p>
                {[
                  { value: "half_day", labelTh: "ครึ่งวัน", labelEn: "Half day" },
                  { value: "none", labelTh: "ไม่จ่าย", labelEn: "No pay" },
                  { value: "pending", labelTh: "ถามอีกครั้งตอน 17:00", labelEn: "Ask at 17:00" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 16px",
                      border: `2px solid ${rainWageDecision === opt.value ? "var(--brand-primary)" : "var(--border)"}`,
                      borderRadius: 10,
                      cursor: "pointer",
                      background: rainWageDecision === opt.value ? "#EFF6FF" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="rainWage"
                      value={opt.value}
                      checked={rainWageDecision === opt.value}
                      onChange={() => setRainWageDecision(opt.value)}
                      style={{ accentColor: "var(--brand-primary)" }}
                    />
                    <span>
                      <strong style={{ fontSize: 15 }}>{opt.labelTh}</strong>
                      <small style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{opt.labelEn}</small>
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setRainModal(false)}
                className="btn-primary"
                style={{ flex: 1, justifyContent: "center", background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                ยกเลิก · Cancel
              </button>
              {rainStatus !== "blocked" && (
                <button
                  onClick={handleRainConfirm}
                  className="btn-primary"
                  style={{ flex: 2, justifyContent: "center", background: "#3B82F6" }}
                >
                  <Check size={18} />
                  ยืนยัน · Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function TransferWorkerModal({
  worker,
  targetSites,
  onTransfer,
  onClose,
  transferring,
}: {
  worker: SiteWorker;
  targetSites: { id: string; name_th: string; name_en: string; status: any }[];
  onTransfer: (siteId: string) => void;
  onClose: () => void;
  transferring: boolean;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "24px", width: "100%", maxWidth: 400, maxHeight: "80dvh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 700 }}>ย้ายพนักงาน · Transfer</h2>
            <small style={{ color: "var(--text-muted)", fontSize: 13 }}>{worker.name_th} → เลือกไซต์ · Select site</small>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
            <XIcon size={22} color="var(--text-muted)" />
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, marginTop: 12 }}>
          {targetSites.length === 0 ? (
            <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px 0", fontSize: 14 }}>ไม่มีไซต์อื่น · No other active sites</p>
          ) : (
            targetSites.map((s) => (
              <button
                key={s.id}
                onClick={() => onTransfer(s.id)}
                disabled={transferring}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 8px",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  background: "transparent",
                  cursor: transferring ? "wait" : "pointer",
                  textAlign: "left",
                }}
              >
                <span className="status-dot" style={{ background: s.status === "live" ? "#22C55E" : "#6B7280", width: 10, height: 10, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <strong style={{ display: "block", fontSize: 15 }}>{s.name_th}</strong>
                  <small style={{ color: "var(--text-muted)", fontSize: 12 }}>{s.name_en}</small>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AttendanceStatusBadge({ status, isLate }: { status: string; isLate: boolean }) {
  if (status === "on_site" && !isLate) {
    return <span style={{ background: "#F0FDF4", color: "#15803D", padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>กำลังทำงาน · On site</span>;
  }
  if (status === "late" || isLate) {
    return <span style={{ background: "#FFF7ED", color: "#C2410C", padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>สาย · Late</span>;
  }
  if (status === "half_day_am") {
    return <span style={{ background: "#FFFBEB", color: "#B45309", padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>ครึ่งวันเช้า</span>;
  }
  if (status === "half_day_pm") {
    return <span style={{ background: "#FFFBEB", color: "#B45309", padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>ครึ่งวันบ่าย</span>;
  }
  return <span style={{ background: "var(--surface)", color: "var(--text-muted)", padding: "3px 8px", borderRadius: 6, fontSize: 12 }}>{status}</span>;
}

function MobileSiteDetail({
  site, workers, attendanceEvents, reported, totalWage, late,
  onCheckIn, onStartReport, onRain, onTransfer, onUpdateSitePhoto, onMoveStage,
  currentStage, rainStatus, today, userRole,
}: {
  site: Site;
  workers: SiteWorker[];
  attendanceEvents: any[];
  reported: number;
  totalWage: number;
  late: number;
  onCheckIn: (w: SiteWorker) => void;
  onStartReport: () => void;
  onRain: () => void;
  onTransfer: (w: SiteWorker) => void;
  onUpdateSitePhoto: () => void;
  onMoveStage: () => void;
  currentStage: SiteStage | null;
  rainStatus: string;
  today: string;
  userRole?: string;
}) {
  return (
    <div>
      {/* Mobile header */}
      <div className="mobile-topbar">
        <Link href="/sites" className="mobile-topbar-back"><ChevronLeft size={24} /></Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>{site.name_th}</h1>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>{site.name_en} · Site detail</p>
        </div>
        {(userRole === "owner" || userRole === "field_manager" || userRole === "technical_admin") && (
          <button
            onClick={onUpdateSitePhoto}
            className="mobile-topbar-action" style={{ padding: "6px 10px" }}
          >
            <ImagePlus size={16} />
          </button>
        )}
        {rainStatus !== "blocked" && (
          <button
            onClick={onRain}
            className="mobile-topbar-action" style={{ padding: "6px 10px" }}
          >
            <CloudRain size={16} /> ฝน
          </button>
        )}
        {userRole === "owner" && (site as any).project_type === "long" && currentStage && (
          <button
            onClick={onMoveStage}
            className="mobile-topbar-action" style={{ padding: "6px 10px", background: "#6C5CE7" }}
          >
            <Zap size={16} />
          </button>
        )}
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <div className="mini-stat">
            <strong>{reported}/{workers.length}</strong>
            <span>รายงาน</span>
            <small>Reported</small>
          </div>
          <div className="mini-stat">
            <strong style={{ color: "#F97316" }}>{late}</strong>
            <span>สาย</span>
            <small>Late</small>
          </div>
          <div className="mini-stat">
            <strong>฿{formatCurrency(totalWage)}</strong>
            <span>ค่าแรง</span>
            <small>Wages</small>
          </div>
        </div>

        {/* Start report button — primary CTA */}
        <button
          className="btn-primary"
          style={{ width: "100%", justifyContent: "center", padding: "16px", fontSize: 17, borderRadius: 14, gap: 10 }}
          onClick={onStartReport}
        >
          <PlayCircle size={22} />
          เริ่มรายงาน · Start Report
        </button>

        {/* Worker list */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            พนักงานวันนี้ <small style={{ color: "var(--text-muted)", fontSize: 12 }}>Today workers</small>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {workers.map((worker) => {
              const event = attendanceEvents.find((e) => e.worker_id === worker.id);
              return (
                <Link
                  key={worker.id}
                  href={`/workers/${worker.id}`}
                  className="mobile-worker-card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="avatar" style={{ width: 40, height: 40, fontSize: 14, flexShrink: 0 }}>
                    {worker.name_th[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: "block", fontSize: 15 }}>{worker.name_th}</strong>
                    <small style={{ color: "var(--text-muted)", fontSize: 12 }}>{worker.name_en}</small>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ display: "block", fontSize: 15 }}>
                      {event?.arrival_time ? formatTime(event.arrival_time) : "-"}
                    </strong>
                    <small style={{ color: event?.is_late ? "#F97316" : "#22C55E", fontSize: 11 }}>
                      {event ? (event.is_late ? "สาย" : "ปกติ") : "ยังไม่รายงาน"}
                    </small>
                  </div>
                  {userRole === "owner" ? (
                    <button
                      onClick={(e) => { e.preventDefault(); onTransfer(worker); }}
                      title="ย้ายไปไซต์อื่น · Transfer"
                      style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center" }}
                    >
                      <UserPlus size={16} color="var(--text-muted)" />
                    </button>
                  ) : (
                    <ChevronRight size={18} color="var(--text-muted)" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AttendanceReportFlow ────────────────────────────────────────────────────
function AttendanceReportFlow({
  site,
  allWorkers,
  attendanceEvents,
  allTodayAttendance,
  yesterdayWorkerIds,
  otherSites,
  today,
  userId,
  onClose,
  onDone,
  showToast,
}: {
  site: Site;
  allWorkers: SiteWorker[];
  attendanceEvents: (AttendanceEvent & { worker?: any })[];
  allTodayAttendance: { worker_id: string; site_id: string }[];
  yesterdayWorkerIds: string[];
  otherSites: { id: string; name_th: string; name_en: string; status: any }[];
  today: string;
  userId?: string;
  onClose: () => void;
  onDone: () => void;
  showToast: (msg: string) => void;
}) {
  const supabase = createClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraWorker, setCameraWorker] = useState<SiteWorker | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const alreadyReportedHere = new Set(
    attendanceEvents.filter((e) => e.status !== "missing").map((e) => e.worker_id)
  );

  // Map: worker_id → site_id for workers reported at a DIFFERENT site today
  const reportedElsewhere = new Map<string, string>(
    allTodayAttendance
      .filter((a) => a.site_id !== site.id)
      .map((a) => [a.worker_id, a.site_id] as [string, string])
  );

  const yesterdaySet = new Set(yesterdayWorkerIds);

  // Pending queue: exclude already-reported (from DB or this session)
  const queue = allWorkers
    .filter((w) => !alreadyReportedHere.has(w.id) && !reportedIds.has(w.id))
    .sort((a, b) => {
      const aY = yesterdaySet.has(a.id) ? 0 : 1;
      const bY = yesterdaySet.has(b.id) ? 0 : 1;
      if (aY !== bY) return aY - bY;
      return a.name_th.localeCompare(b.name_th, "th");
    });

  async function openCamera(worker: SiteWorker) {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch {
      showToast("ไม่สามารถเปิดกล้องได้ · Camera access denied");
      return;
    }
    streamRef.current = stream;
    // Set worker AFTER stream is ready so the video callback-ref can immediately apply srcObject
    setCameraWorker(worker);
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraWorker(null);
  }

  async function capturePhoto() {
    if (!videoRef.current || !cameraWorker) return;
    setCapturing(true);

    // Wait for video to have frame data
    if (videoRef.current.readyState < 2) {
      await new Promise<void>((res) => {
        const v = videoRef.current!;
        const onReady = () => { v.removeEventListener("canplay", onReady); res(); };
        v.addEventListener("canplay", onReady);
        setTimeout(res, 2000); // fallback timeout
      });
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);

    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    if (!blob) {
      showToast("กล้องยังไม่พร้อม · Camera not ready, try again");
      setCapturing(false);
      return;
    }
    const fileName = `attendance/${site.id}/${today}/${cameraWorker.id}_${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("attendance-photos")
      .upload(fileName, blob, { contentType: "image/jpeg", upsert: false });

    let photoUrl: string | null = null;
    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage.from("attendance-photos").getPublicUrl(fileName);
      photoUrl = urlData?.publicUrl ?? null;
    }

    const now = new Date();
    const bangkokTime = now.toLocaleTimeString("en-US", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const isLate = bangkokTime > "08:00";
    const wageReason = computeAttendanceWageReason(bangkokTime, site.status as any);
    const wageAmount = wageReason ? computeWageAmount(cameraWorker.daily_wage, wageReason) : 0;

    const { error: dbError } = await supabase.from("attendance_events").insert({
      owner_id: site.owner_id,
      site_id: site.id,
      worker_id: cameraWorker.id,
      reported_by: userId ?? null,
      event_date: today,
      arrival_time: bangkokTime,
      photo_url: photoUrl,
      photo_lat: lat,
      photo_lng: lng,
      status: isLate ? "late" : "on_site",
      is_late: isLate,
      wage_reason: wageReason,
      wage_amount: wageAmount,
    });

    await supabase.from("workers").update({ assigned_site_id: site.id }).eq("id", cameraWorker.id);

    // First check-in → site goes live
    if (alreadyReportedHere.size === 0 && reportedIds.size === 0) {
      await supabase.from("site_day_status_events").upsert(
        {
          owner_id: site.owner_id,
          site_id: site.id,
          event_date: today,
          status: "live",
          set_by: userId,
          set_at: now.toISOString(),
          set_before_attendance: false,
          wage_decision: "full_day",
          wage_reason: "full_day",
          attendance_count_at_change: 0,
        },
        { onConflict: "site_id,event_date" }
      );
      await supabase.from("sites").update({ status: "live" }).eq("id", site.id);
    }

    setCapturing(false);
    if (dbError) {
      console.error("[attendance] DB error:", dbError);
      showToast("เกิดข้อผิดพลาด · " + (dbError.message ?? "Error saving"));
      closeCamera();
      return;
    }

    setReportedIds((prev) => { const s = new Set(Array.from(prev)); s.add(cameraWorker.id); return s; });
    showToast(`✓ ${cameraWorker.name_th} · ${bangkokTime}${isLate ? " (สาย)" : ""}`);
    closeCamera();
  }

  function getSiteColor(siteId: string) {
    const s = otherSites.find((o) => o.id === siteId);
    if (!s) return "#6B7280";
    if (s.status === "live") return "#06B6D4";
    if (s.status === "done") return "#22C55E";
    return "#F97316";
  }

  // ── Camera view ─────────────────────────────────────────────────────────────
  if (cameraWorker) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.97)", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ color: "white", padding: "20px 16px", textAlign: "center", width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{cameraWorker.name_th}</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>{cameraWorker.name_en}</div>
        </div>
        <video
          ref={(el) => {
            (videoRef as any).current = el;
            if (el && streamRef.current) el.srcObject = streamRef.current;
          }}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", maxWidth: 520, flex: 1, objectFit: "cover" }}
        />
        <div style={{ padding: "20px 16px", display: "flex", gap: 12, width: "100%", maxWidth: 520 }}>
          <button
            onClick={closeCamera}
            className="btn-primary"
            style={{ background: "rgba(255,255,255,0.15)", flex: 1, justifyContent: "center" }}
          >
            ยกเลิก · Cancel
          </button>
          <button
            onClick={capturePhoto}
            disabled={capturing}
            className="btn-primary"
            style={{ flex: 2, justifyContent: "center" }}
          >
            <Camera size={20} />
            {capturing ? "กำลังบันทึก…" : "ถ่ายภาพ · Capture"}
          </button>
        </div>
      </div>
    );
  }

  // ── Worker list view ─────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, background: "white", zIndex: 999, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div className="mobile-topbar" style={{ gap: 10 }}>
        <button
          onClick={onClose}
          className="mobile-topbar-action"
          style={{ padding: "7px 8px" }}
        >
          <XIcon size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1E3A8A" }}>รายงานการเข้างาน</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Attendance Report · {site.name_th}</div>
        </div>
        <div style={{ color: "white", textAlign: "right", minWidth: 40 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{reportedIds.size}</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>รายงานแล้ว</div>
        </div>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 104px" }}>
        {queue.length === 0 && reportedIds.size === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>รายงานครบทุกคนแล้ว</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>All workers reported today</div>
          </div>
        ) : (
          <>
            {queue.some((w) => yesterdaySet.has(w.id)) && (
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, marginTop: 4 }}>
                เมื่อวาน · Yesterday
              </div>
            )}

            {queue.map((worker, idx) => {
              const isYesterday = yesterdaySet.has(worker.id);
              const elsewhereId = reportedElsewhere.get(worker.id);
              const isDisabled = !!elsewhereId;
              const elsewhereSite = elsewhereId ? otherSites.find((s) => s.id === elsewhereId) : null;
              const prevWorker = idx > 0 ? queue[idx - 1] : null;
              const showOtherHeader = !isYesterday && !!prevWorker && yesterdaySet.has(prevWorker.id);

              return (
                <div key={worker.id}>
                  {showOtherHeader && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, marginTop: 16 }}>
                      คนอื่น · Others
                    </div>
                  )}
                  <button
                    onClick={() => !isDisabled && openCamera(worker)}
                    disabled={isDisabled}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "13px 12px",
                      borderRadius: 12,
                      border: `1px solid ${isYesterday && !isDisabled ? "var(--brand-primary)" : "var(--border)"}`,
                      background: isDisabled ? "#F9FAFB" : isYesterday ? "#EFF6FF" : "white",
                      cursor: isDisabled ? "default" : "pointer",
                      marginBottom: 8,
                      opacity: isDisabled ? 0.55 : 1,
                      textAlign: "left",
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%",
                      background: isYesterday ? "var(--brand-primary)" : "#E5E7EB",
                      color: isYesterday ? "white" : "var(--text-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, fontWeight: 700, flexShrink: 0,
                    }}>
                      {worker.name_th[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: isDisabled ? "var(--text-muted)" : "var(--text-primary)" }}>
                        {worker.name_th}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                        {elsewhereSite ? (
                          <span style={{ color: "#F97316" }}>
                            ที่ {elsewhereSite.name_th} · At {elsewhereSite.name_en ?? "another site"}
                          </span>
                        ) : (
                          worker.name_en
                        )}
                      </div>
                    </div>
                    {isDisabled ? (
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: getSiteColor(elsewhereId!), flexShrink: 0, display: "inline-block" }} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: "var(--brand-primary)" }}>
                        <Camera size={20} />
                        <span style={{ fontSize: 10, fontWeight: 600 }}>ถ่ายภาพ</span>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}

            {reportedIds.size > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#16A34A", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, marginTop: 20 }}>
                  รายงานแล้ว · Reported
                </div>
                {allWorkers.filter((w) => reportedIds.has(w.id)).map((worker) => (
                  <div key={worker.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 12px",
                    borderRadius: 12, border: "1px solid #BBF7D0", background: "#F0FDF4", marginBottom: 8,
                  }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#22C55E", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                      {worker.name_th[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{worker.name_th}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{worker.name_en}</div>
                    </div>
                    <Check size={20} color="#22C55E" />
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Send button — sticky bottom */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 16px", background: "white", borderTop: "1px solid var(--border)" }}>
        <button
          onClick={onDone}
          disabled={reportedIds.size === 0}
          className="btn-primary"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "16px",
            fontSize: 17,
            borderRadius: 14,
            gap: 10,
            opacity: reportedIds.size > 0 ? 1 : 0.35,
          }}
        >
          <Send size={20} />
          ส่ง · Send ({reportedIds.size})
        </button>
      </div>
    </div>
  );
}
