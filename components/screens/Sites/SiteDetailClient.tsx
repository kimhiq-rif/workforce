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
  UserCheck, Zap,
} from "lucide-react";
import { formatThaiDate, formatEnDate, formatCurrency, formatTime } from "@/lib/format";
import { computeAttendanceWageReason, computeWageAmount, canSetRainStatus, wageReasonLabel } from "@/lib/wage-logic";
import type { Site, AttendanceEvent, SiteDayStatusEvent, Worker } from "@/types/database";

type SiteWorker = Pick<
  Worker,
  "id" | "name_th" | "name_en" | "role_th" | "role_en" | "daily_wage" | "is_temporary" | "photo_url"
>;

interface SiteDetailClientProps {
  site: Site & { manager?: { id: string; name_th: string; name_en: string } | null };
  attendanceEvents: (AttendanceEvent & {
    worker?: { id: string; name_th: string; name_en: string; role_th: string | null; role_en: string | null; daily_wage: number; is_temporary: boolean; photo_url: string | null } | null;
  })[];
  dayStatus: SiteDayStatusEvent | null;
  workers: SiteWorker[];
  otherSites: { id: string; name_th: string; name_en: string; status: any }[];
  todayReceipts: any[];
  today: string;
  userId?: string;
  userRole?: string;
}

export function SiteDetailClient({
  site,
  attendanceEvents,
  dayStatus,
  workers,
  otherSites,
  todayReceipts,
  today,
  userId,
  userRole,
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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const reported = attendanceEvents.filter((e) => e.status !== "missing").length;
  const onSite = attendanceEvents.filter((e) => e.status === "on_site").length;
  const late = attendanceEvents.filter((e) => e.is_late).length;
  const totalWage = attendanceEvents.reduce((sum, e) => sum + (e.wage_amount ?? 0), 0);

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
        <div style={{ display: "flex", gap: 8 }}>
          <SiteStatusBadge status={site.status as any} />
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
                <div
                  key={worker.id}
                  className="table-row"
                  style={{ gridTemplateColumns: "2fr 100px 120px 120px 110px", display: "grid", padding: "12px 20px", gap: 12 }}
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
                        onClick={() => startCamera(worker)}
                        className="btn-primary"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                      >
                        <Camera size={14} /> ถ่าย
                      </button>
                    )}
                  </span>
                </div>
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
            onRain={() => setRainModal(true)}
            rainStatus={rainStatus}
            today={today}
          />
        </div>
      </DashboardShell>

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

          {/* Worker selector */}
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
            {workers.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedWorker(w)}
                style={{
                  flexShrink: 0,
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: selectedWorker?.id === w.id ? "white" : "transparent",
                  color: selectedWorker?.id === w.id ? "var(--brand-primary)" : "white",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {w.name_th}
              </button>
            ))}
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
  onCheckIn, onRain, rainStatus, today,
}: {
  site: Site;
  workers: SiteWorker[];
  attendanceEvents: any[];
  reported: number;
  totalWage: number;
  late: number;
  onCheckIn: (w: SiteWorker) => void;
  onRain: () => void;
  rainStatus: string;
  today: string;
}) {
  return (
    <div>
      {/* Mobile header */}
      <div className="mobile-topbar">
        <Link href="/sites" className="mobile-topbar-back"><ChevronLeft size={24} /></Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white", fontSize: 19 }}>{site.name_th}</h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>{site.name_en} · Site detail</p>
        </div>
        {rainStatus !== "blocked" && (
          <button
            onClick={onRain}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}
          >
            <CloudRain size={16} /> ฝน
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

        {/* Check-in button */}
        <button
          className="btn-primary"
          style={{ width: "100%", justifyContent: "center", padding: "14px" }}
          onClick={() => workers.length && onCheckIn(workers[0])}
        >
          <Camera size={20} />
          ถ่ายภาพ Check-in
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
                  <ChevronRight size={18} color="var(--text-muted)" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
