"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Camera, X, ChevronLeft, Check, AlertTriangle, Send } from "lucide-react";
import { formatTime } from "@/lib/format";
import { computeAttendanceWageReason, computeWageAmount, isAttendanceWindowOpen, ATTENDANCE_OPENS, ATTENDANCE_CLOSES } from "@/lib/wage-logic";
import { siteStatusColor } from "@/components/ui/SiteStatusBadge";
import type { Site, AttendanceEvent } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

type SiteWorker = {
  id: string;
  name_th: string;
  name_en: string;
  role_th: string | null;
  role_en: string | null;
  daily_wage: number;
  is_temporary: boolean;
  photo_url: string | null;
};

export type OtherSiteWorker = {
  workerId: string;
  workerNameTh: string;
  workerNameEn: string;
  workerRoleTh: string | null;
  workerRoleEn: string | null;
  workerDailyWage: number;
  fromSiteId: string;
  fromSiteNameTh: string;
  fromSiteNameEn: string;
  fromSiteStatus: string;
};

type WorkerInQueue = SiteWorker & {
  isYesterday: boolean;
  isOtherSite: boolean;
  fromSiteId?: string;
  fromSiteNameTh?: string;
  fromSiteColor?: string;
};

type MissingReason = "sick" | "day_off" | "family" | "other";
type FlowPhase = "queue" | "camera" | "preview" | "missing";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  site: Site;
  workers: SiteWorker[];
  attendanceEvents: AttendanceEvent[];
  yesterdayWorkerIds: string[];
  otherSiteWorkers: OtherSiteWorker[];
  userId: string;
  today: string;
  onDone: () => void;
  onClose: () => void;
}

// ─── Bangkok time helper ──────────────────────────────────────────────────────

function getBangkokTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AttendanceReportFlow({
  site,
  workers,
  attendanceEvents,
  yesterdayWorkerIds,
  otherSiteWorkers,
  userId,
  today,
  onDone,
  onClose,
}: Props) {
  const supabase = createClient();

  const [phase, setPhase] = useState<FlowPhase>("queue");
  const [selectedWorker, setSelectedWorker] = useState<WorkerInQueue | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [missingReasons, setMissingReasons] = useState<Record<string, MissingReason>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [currentTime, setCurrentTime] = useState(getBangkokTime);

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");

  // Update clock every 30s for half-day banner
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(getBangkokTime()), 30_000);
    return () => clearInterval(id);
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  // ── Queue construction ─────────────────────────────────────────────────────

  const alreadyReportedAtSite = useMemo(() => {
    const ids = new Set(attendanceEvents.map((e) => e.worker_id));
    reportedIds.forEach((id) => ids.add(id));
    return ids;
  }, [attendanceEvents, reportedIds]);

  const queue = useMemo<WorkerInQueue[]>(() => {
    // Workers assigned to this site, not yet reported today
    const siteWorkerQueue: WorkerInQueue[] = workers
      .filter((w) => !alreadyReportedAtSite.has(w.id))
      .map((w) => ({
        ...w,
        isYesterday: yesterdayWorkerIds.includes(w.id),
        isOtherSite: false,
      }));

    // Workers from other sites (for transfer)
    const assignedIds = new Set(workers.map((w) => w.id));
    const otherQueue: WorkerInQueue[] = otherSiteWorkers
      .filter((o) => !alreadyReportedAtSite.has(o.workerId))
      .filter((o) => !assignedIds.has(o.workerId)) // not already in site queue
      .map((o) => ({
        id: o.workerId,
        name_th: o.workerNameTh,
        name_en: o.workerNameEn,
        role_th: o.workerRoleTh,
        role_en: o.workerRoleEn,
        daily_wage: o.workerDailyWage,
        is_temporary: false,
        photo_url: null,
        isYesterday: false,
        isOtherSite: true,
        fromSiteId: o.fromSiteId,
        fromSiteNameTh: o.fromSiteNameTh,
        fromSiteColor: siteStatusColor(o.fromSiteStatus as any),
      }));

    // Sort: yesterday first (blue), then alphabetical; other-site workers at end
    const sortByName = (a: WorkerInQueue, b: WorkerInQueue) =>
      a.name_th.localeCompare(b.name_th, "th");

    return [
      ...siteWorkerQueue.filter((w) => w.isYesterday).sort(sortByName),
      ...siteWorkerQueue.filter((w) => !w.isYesterday).sort(sortByName),
      ...otherQueue.sort(sortByName),
    ];
  }, [workers, alreadyReportedAtSite, yesterdayWorkerIds, otherSiteWorkers]);

  // Workers not yet reported and not yet marked missing (for missing section)
  const unreportedWorkers = useMemo(() => {
    return workers.filter(
      (w) =>
        !alreadyReportedAtSite.has(w.id) &&
        !missingReasons[w.id]
    );
  }, [workers, alreadyReportedAtSite, missingReasons]);

  const totalSiteWorkers = workers.length;
  const reportedCount = reportedIds.size + attendanceEvents.filter((e) => e.status !== "missing").length;

  // Half-day banner: show if 12:00–13:00
  const [h, m] = currentTime.split(":").map(Number);
  const nowMins = h * 60 + m;
  const showHalfDayBanner = nowMins >= 12 * 60 && nowMins < 13 * 60;

  // ── Camera ─────────────────────────────────────────────────────────────────

  function isMobileDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  async function openCamera(worker: WorkerInQueue) {
    setSelectedWorker(worker);
    setCapturedBlob(null);
    setCapturedDataUrl(null);
    setCameraError("");

    if (isMobileDevice()) {
      fileInputRef.current?.click();
      return;
    }

    setPhase("camera");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError("ไม่สามารถเปิดกล้องได้ · Camera access denied");
    }
  }

  function handleMobileFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCapturedDataUrl(ev.target?.result as string);
      setCapturedBlob(file);
      setPhase("preview");
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  const videoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  async function capturePhoto() {
    if (!videoRef.current) return;

    const video = videoRef.current;

    // Wait for video to be ready
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) { resolve(); return; }
      const onCanPlay = () => { video.removeEventListener("canplay", onCanPlay); resolve(); };
      video.addEventListener("canplay", onCanPlay);
      setTimeout(resolve, 2000);
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob>((res) => canvas.toBlob(res as any, "image/jpeg", 0.85));
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    stopCamera();
    setCapturedBlob(blob);
    setCapturedDataUrl(dataUrl);
    setPhase("preview");
  }

  function retakePhoto() {
    setCapturedBlob(null);
    setCapturedDataUrl(null);
    openCamera(selectedWorker!);
  }

  // ── Save attendance ────────────────────────────────────────────────────────

  async function confirmAttendance() {
    if (!selectedWorker || !capturedBlob) return;
    setSaving(true);

    // GPS (optional)
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    // Upload photo
    const fileName = `attendance/${site.id}/${today}/${selectedWorker.id}_${Date.now()}.jpg`;
    let photoUrl: string | null = null;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("attendance-photos")
      .upload(fileName, capturedBlob, { contentType: "image/jpeg", upsert: false });

    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage
        .from("attendance-photos")
        .getPublicUrl(fileName);
      photoUrl = urlData?.publicUrl ?? null;
    }

    const bangkokTime = getBangkokTime();
    const isLate = bangkokTime > "08:00";
    const wageReason = computeAttendanceWageReason(bangkokTime, site.status as any);
    const wageAmount = computeWageAmount(selectedWorker.daily_wage, wageReason);

    // Save attendance event
    const { error: dbError } = await supabase.from("attendance_events").insert({
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
    });

    if (dbError) {
      showToast("เกิดข้อผิดพลาด · Error saving · " + dbError.message);
      setSaving(false);
      return;
    }

    // If transfer: create SiteTransferEvent + push to owner
    if (selectedWorker.isOtherSite && selectedWorker.fromSiteId) {
      await supabase.from("site_transfer_events").insert({
        owner_id: site.owner_id,
        worker_id: selectedWorker.id,
        from_site_id: selectedWorker.fromSiteId,
        to_site_id: site.id,
        event_date: today,
        transfer_time: bangkokTime,
        source: "photo_transfer",
        performed_by: userId,
      });

      // Push notification to owner about transfer
      await fetch("/api/push/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerNameTh: selectedWorker.name_th,
          fromSiteNameTh: selectedWorker.fromSiteNameTh,
          toSiteNameTh: site.name_th,
          ownerId: site.owner_id,
        }),
      }).catch(() => {}); // non-blocking
    }

    // Auto-set site to "live" on first check-in
    if (reportedCount === 0) {
      await supabase
        .from("sites")
        .update({ status: "live" })
        .eq("id", site.id)
        .eq("status", "waiting");
    }

    setReportedIds((prev) => { const next = new Set(prev); next.add(selectedWorker.id); return next; });
    setSaving(false);

    const transferNote = selectedWorker.isOtherSite
      ? ` · โอนจาก ${selectedWorker.fromSiteNameTh}`
      : "";
    showToast(`✓ ${selectedWorker.name_th} · ${bangkokTime}${isLate ? " (สาย)" : ""}${transferNote}`);
    setPhase("queue");
  }

  function cancelCamera() {
    stopCamera();
    setCapturedBlob(null);
    setCapturedDataUrl(null);
    setSelectedWorker(null);
    setPhase("queue");
  }

  // ── Missing workers ────────────────────────────────────────────────────────

  async function saveMissingReasons() {
    setSaving(true);
    const entries = Object.entries(missingReasons);

    for (const [workerId, reason] of entries) {
      const worker = workers.find((w) => w.id === workerId);
      if (!worker) continue;

      const status = reason === "day_off" ? "day_off" : "missing";

      await supabase.from("attendance_events").insert({
        owner_id: site.owner_id,
        site_id: site.id,
        worker_id: workerId,
        reported_by: userId,
        event_date: today,
        arrival_time: null,
        status,
        is_late: false,
        wage_reason: "no_pay_day_off",
        wage_amount: 0,
        notes: reason,
      });
    }

    setSaving(false);
    onDone();
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  const progressPct = totalSiteWorkers > 0
    ? Math.round((reportedCount / totalSiteWorkers) * 100)
    : 0;

  const missingReasonLabels: Record<MissingReason, { th: string; en: string }> = {
    sick:    { th: "ป่วย",     en: "Sick" },
    day_off: { th: "หยุด",     en: "Day off" },
    family:  { th: "ครอบครัว", en: "Family" },
    other:   { th: "อื่นๆ",   en: "Other" },
  };

  // ── Attendance window guard ────────────────────────────────────────────────

  if (!isAttendanceWindowOpen(currentTime)) {
    const beforeWindow = currentTime < ATTENDANCE_OPENS;
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "white", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          background: "var(--brand-primary)", color: "white",
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "white", cursor: "pointer", padding: 4 }}
          >
            <X size={22} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>รายงานพนักงาน · Report</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{site.name_th}</div>
          </div>
        </div>

        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "32px 24px", textAlign: "center", gap: 16,
        }}>
          <div style={{ fontSize: 48 }}>{beforeWindow ? "🌅" : "🌙"}</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
              {beforeWindow ? "ยังไม่ถึงเวลารายงาน" : "หมดเวลารายงานแล้ว"}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {beforeWindow
                ? `Attendance opens at ${ATTENDANCE_OPENS}`
                : `Attendance closed at ${ATTENDANCE_CLOSES}`}
            </div>
          </div>
          <div style={{
            background: "var(--surface)", borderRadius: 12, padding: "16px 24px",
            fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6,
          }}>
            <div>เวลารายงานนักงาน · Attendance window</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>
              {ATTENDANCE_OPENS} – {ATTENDANCE_CLOSES}
            </div>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              เวลาปัจจุบัน · Now: <strong>{currentTime}</strong>
            </div>
          </div>
          {beforeWindow && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              ระบบรีเซ็ตทุกคืน 00:00 · System resets daily at midnight
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Phase: Queue ───────────────────────────────────────────────────────────

  if (phase === "queue") {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "white", display: "flex", flexDirection: "column",
        fontFamily: "inherit",
      }}>
        {/* Header */}
        <div style={{
          background: "var(--brand-primary)", color: "white",
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "white", cursor: "pointer", padding: 4 }}
          >
            <X size={22} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              รายงานพนักงาน · Report
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{site.name_th}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13 }}>
            <div style={{ fontWeight: 700 }}>{reportedCount}/{totalSiteWorkers}</div>
            <div style={{ opacity: 0.8 }}>รายงาน</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: "rgba(30,58,138,0.15)", flexShrink: 0 }}>
          <div style={{
            height: "100%", background: "#22C55E",
            width: `${progressPct}%`, transition: "width 0.3s",
          }} />
        </div>

        {/* Half-day banner */}
        {showHalfDayBanner && (
          <div style={{
            background: "#FFFBEB", borderBottom: "1px solid #FCD34D",
            padding: "10px 16px", display: "flex", alignItems: "center", gap: 8,
            fontSize: 13, color: "#92400E", flexShrink: 0,
          }}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>
              <strong>พนักงานที่รายงานตอนนี้ = ครึ่งวัน</strong>
              <br />
              <span style={{ opacity: 0.8 }}>Workers reported now will be marked as half day PM</span>
            </span>
          </div>
        )}

        {/* Worker list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {queue.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)" }}>
              <Check size={40} style={{ margin: "0 auto 12px", color: "#22C55E" }} />
              <div style={{ fontSize: 17, fontWeight: 600 }}>รายงานครบแล้ว</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>All workers reported</div>
            </div>
          ) : (
            <>
              {/* Section label: other-site workers */}
              {queue.some((w) => !w.isOtherSite) && (
                <div style={{ padding: "6px 16px 2px", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  พนักงานไซต์นี้ · This site
                </div>
              )}

              {queue.map((worker, idx) => {
                const isFirstOtherSite = worker.isOtherSite && (idx === 0 || !queue[idx - 1].isOtherSite);
                return (
                  <div key={worker.id}>
                    {isFirstOtherSite && (
                      <div style={{ padding: "10px 16px 2px", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, borderTop: "1px solid var(--border)", marginTop: 6 }}>
                        เพิ่งรายงานจากไซต์อื่น · Transferred from other site
                      </div>
                    )}
                    <button
                      onClick={() => openCamera(worker)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center",
                        gap: 14, padding: "12px 16px",
                        background: "none", border: "none", cursor: "pointer",
                        borderBottom: "1px solid var(--border)",
                        textAlign: "left",
                      }}
                    >
                      {/* Avatar */}
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: "50%",
                          background: worker.isYesterday ? "#DBEAFE" : "var(--surface)",
                          border: `2px solid ${worker.isYesterday ? "#3B82F6" : "var(--border)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 17, fontWeight: 700,
                          color: worker.isYesterday ? "#1D4ED8" : "var(--text-primary)",
                        }}>
                          {worker.name_th[0]}
                        </div>
                        {/* Transfer dot */}
                        {worker.isOtherSite && worker.fromSiteColor && (
                          <div style={{
                            position: "absolute", bottom: 0, right: 0,
                            width: 14, height: 14, borderRadius: "50%",
                            background: worker.fromSiteColor,
                            border: "2px solid white",
                          }} />
                        )}
                        {/* Yesterday dot */}
                        {worker.isYesterday && !worker.isOtherSite && (
                          <div style={{
                            position: "absolute", bottom: 0, right: 0,
                            width: 14, height: 14, borderRadius: "50%",
                            background: "#3B82F6",
                            border: "2px solid white",
                          }} />
                        )}
                      </div>

                      {/* Name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                          {worker.name_th}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                          {worker.name_en}
                          {worker.isOtherSite && worker.fromSiteNameTh && (
                            <span style={{ color: worker.fromSiteColor, fontWeight: 600 }}>
                              {" · "}จาก {worker.fromSiteNameTh}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Camera icon */}
                      <Camera size={20} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Bottom actions */}
        <div style={{
          padding: "12px 16px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex", flexDirection: "column", gap: 10,
          flexShrink: 0,
          background: "white",
        }}>
          {/* Missing workers button */}
          {unreportedWorkers.length > 0 && reportedCount > 0 && (
            <button
              onClick={() => setPhase("missing")}
              style={{
                width: "100%", padding: "12px", border: "1px solid var(--border)",
                borderRadius: 10, background: "none", cursor: "pointer",
                fontSize: 15, color: "var(--text-muted)", display: "flex",
                alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <AlertTriangle size={16} />
              พนักงานที่ขาด ({unreportedWorkers.length}) · Missing workers
            </button>
          )}

          {/* Send button */}
          <button
            onClick={reportedCount > 0 ? onDone : undefined}
            disabled={reportedCount === 0}
            className="btn-primary"
            style={{
              width: "100%", justifyContent: "center", padding: "14px",
              fontSize: 16, fontWeight: 700,
              opacity: reportedCount === 0 ? 0.4 : 1,
              cursor: reportedCount === 0 ? "not-allowed" : "pointer",
            }}
          >
            <Send size={18} />
            ส่งรายงาน · Send report
          </button>
        </div>

        {toast && (
          <div style={{
            position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
            background: "#1E3A8A", color: "white", padding: "10px 18px",
            borderRadius: 10, fontSize: 14, whiteSpace: "nowrap",
            zIndex: 2000, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          }}>
            {toast}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleMobileFileInput}
        />
      </div>
    );
  }

  // ── Phase: Camera ──────────────────────────────────────────────────────────

  if (phase === "camera") {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "#000", display: "flex", flexDirection: "column",
      }}>
        {/* Camera header */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          padding: "16px", display: "flex", alignItems: "center", gap: 12,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
        }}>
          <button
            onClick={cancelCamera}
            style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}
          >
            <ChevronLeft size={28} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "white", fontSize: 17, fontWeight: 700 }}>
              {selectedWorker?.name_th}
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
              {selectedWorker?.name_en}
              {selectedWorker?.isOtherSite && (
                <span style={{ color: selectedWorker.fromSiteColor }}>
                  {" · "}โอนจาก {selectedWorker.fromSiteNameTh}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Camera preview */}
        {cameraError ? (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            color: "white", gap: 16, padding: 24,
          }}>
            <AlertTriangle size={40} color="#F97316" />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{cameraError}</div>
            </div>
            <button
              onClick={cancelCamera}
              style={{
                padding: "12px 24px", background: "white", color: "#1E3A8A",
                border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer",
              }}
            >
              ย้อนกลับ · Back
            </button>
          </div>
        ) : (
          <video
            ref={videoCallbackRef}
            autoPlay
            playsInline
            muted
            style={{ flex: 1, objectFit: "cover", width: "100%" }}
          />
        )}

        {/* Capture button */}
        {!cameraError && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "24px 32px 40px",
            background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
            display: "flex", justifyContent: "center",
          }}>
            <button
              onClick={capturePhoto}
              style={{
                width: 72, height: 72, borderRadius: "50%",
                border: "4px solid white", background: "white",
                cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#1E3A8A" }} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Phase: Preview ─────────────────────────────────────────────────────────

  if (phase === "preview") {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "#000", display: "flex", flexDirection: "column",
      }}>
        {/* Preview header */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          padding: "16px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
        }}>
          <div style={{ color: "white", fontSize: 17, fontWeight: 700 }}>
            {selectedWorker?.name_th}
          </div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
            {selectedWorker?.isOtherSite
              ? `โอนจาก ${selectedWorker.fromSiteNameTh} → ${site.name_th}`
              : site.name_th}
          </div>
        </div>

        {capturedDataUrl && (
          <img
            src={capturedDataUrl}
            alt="preview"
            style={{ flex: 1, objectFit: "cover", width: "100%" }}
          />
        )}

        {/* Confirm / Retake */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "20px 24px 40px",
          background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
          display: "flex", gap: 16,
        }}>
          <button
            onClick={retakePhoto}
            disabled={saving}
            style={{
              flex: 1, padding: "14px", borderRadius: 12,
              border: "2px solid white", background: "transparent",
              color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer",
            }}
          >
            ถ่ายใหม่ · Retake
          </button>
          <button
            onClick={confirmAttendance}
            disabled={saving}
            style={{
              flex: 2, padding: "14px", borderRadius: 12,
              border: "none", background: "#22C55E",
              color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Check size={18} />
            {saving ? "กำลังบันทึก..." : "ยืนยัน · Confirm"}
          </button>
        </div>
      </div>
    );
  }

  // ── Phase: Missing workers ─────────────────────────────────────────────────

  if (phase === "missing") {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "white", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          background: "var(--brand-primary)", color: "white",
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
          flexShrink: 0,
        }}>
          <button
            onClick={() => setPhase("queue")}
            style={{ background: "none", border: "none", color: "white", cursor: "pointer", padding: 4 }}
          >
            <ChevronLeft size={22} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>พนักงานที่ขาด</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Missing workers · {site.name_th}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {unreportedWorkers.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)" }}>
              <Check size={40} style={{ margin: "0 auto 12px", color: "#22C55E" }} />
              <div style={{ fontSize: 17, fontWeight: 600 }}>ไม่มีพนักงานที่ขาด</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>No missing workers</div>
            </div>
          ) : (
            <div style={{ padding: "8px 0" }}>
              <div style={{ padding: "8px 16px 4px", fontSize: 13, color: "var(--text-muted)" }}>
                เลือกเหตุผลสำหรับพนักงานที่ยังไม่รายงาน · Select reason for unreported workers
              </div>
              {unreportedWorkers.map((worker) => (
                <div
                  key={worker.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: "var(--surface)", border: "1px solid var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, fontWeight: 700, flexShrink: 0,
                    }}>
                      {worker.name_th[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{worker.name_th}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{worker.name_en}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {(["sick", "day_off", "family", "other"] as MissingReason[]).map((reason) => {
                      const selected = missingReasons[worker.id] === reason;
                      return (
                        <button
                          key={reason}
                          onClick={() =>
                            setMissingReasons((prev) => ({
                              ...prev,
                              [worker.id]: selected ? undefined as any : reason,
                            }))
                          }
                          style={{
                            padding: "8px 4px",
                            borderRadius: 8,
                            border: `2px solid ${selected ? "var(--brand-primary)" : "var(--border)"}`,
                            background: selected ? "#EFF6FF" : "transparent",
                            cursor: "pointer",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: selected ? 700 : 400, color: selected ? "var(--brand-primary)" : "var(--text-primary)" }}>
                            {missingReasonLabels[reason].th}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                            {missingReasonLabels[reason].en}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Done button */}
        <div style={{ padding: "12px 16px 28px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button
            onClick={saveMissingReasons}
            disabled={saving}
            className="btn-primary"
            style={{
              width: "100%", justifyContent: "center", padding: "14px",
              fontSize: 16, fontWeight: 700,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Send size={18} />
            {saving ? "กำลังบันทึก..." : "ส่งรายงาน · Send report"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
