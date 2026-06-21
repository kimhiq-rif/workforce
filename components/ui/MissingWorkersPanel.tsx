"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Clock, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";

type MissingStatus = "late_today" | "missing_72h" | "absent_marked";

interface MissingWorker {
  workerId: string;
  nameTh: string;
  nameEn: string;
  dailyWage: number;
  isTemporary: boolean;
  daysWorked30d: number;
  lastAttendanceDate: string | null;
  status: MissingStatus;
}

const ABSENCE_OPTIONS = [
  { value: "sick",    labelTh: "ป่วย",          labelEn: "Sick",         color: "#EF4444" },
  { value: "day_off", labelTh: "หยุดพัก",       labelEn: "Day off",      color: "#3B82F6" },
  { value: "family",  labelTh: "ธุระครอบครัว",  labelEn: "Family event", color: "#F59E0B" },
  { value: "other",   labelTh: "อื่นๆ",          labelEn: "Other",        color: "#6B7280" },
] as const;

type AbsenceReason = typeof ABSENCE_OPTIONS[number]["value"];

interface MarkingState {
  workerId: string;
  reason: AbsenceReason | null;
  note: string;
  saving: boolean;
}

interface Props {
  date: string;
  onCountChange?: (count: number) => void;
}

export function MissingWorkersPanel({ date, onCountChange }: Props) {
  const [workers, setWorkers]     = useState<MissingWorker[]>([]);
  const [loading, setLoading]     = useState(true);
  const [marking, setMarking]     = useState<MarkingState | null>(null);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workers/missing?date=${date}`);
      const json = await res.json();
      const list: MissingWorker[] = json.missing ?? [];
      setWorkers(list);
      onCountChange?.(list.filter((w) => w.status !== "absent_marked").length);
    } finally {
      setLoading(false);
    }
  }, [date, onCountChange]);

  useEffect(() => { load(); }, [load]);

  async function saveAbsence() {
    if (!marking?.reason) return;
    setMarking((m) => m ? { ...m, saving: true } : null);
    await fetch("/api/workers/missing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workerId: marking.workerId,
        date,
        reason: marking.reason,
        note: marking.note || undefined,
      }),
    });
    setMarkedIds((prev) => { const s = new Set(prev); s.add(marking.workerId); return s; });
    setMarking(null);
    load();
  }

  if (loading) {
    return (
      <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        กำลังโหลด...
      </div>
    );
  }

  const visible = workers.filter((w) => !markedIds.has(w.workerId));
  if (visible.length === 0) {
    return (
      <div style={{ padding: "16px 0", textAlign: "center", color: "#22C55E", fontSize: 14 }}>
        ✓ พนักงานทุกคนรายงานแล้ว<br />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>All workers reported</span>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((w) => {
          const isRed    = w.status === "missing_72h";
          const color    = isRed ? "#EF4444" : "#F59E0B";
          const bgColor  = isRed ? "#FEF2F2" : "#FFFBEB";
          const dotColor = isRed ? "#EF4444" : "#F59E0B";

          return (
            <div
              key={w.workerId}
              style={{
                background: bgColor,
                border: `1px solid ${isRed ? "#FECACA" : "#FDE68A"}`,
                borderRadius: 10,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
              }}
              onClick={() => setMarking({ workerId: w.workerId, reason: null, note: "", saving: false })}
            >
              {/* Status dot */}
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: dotColor, flexShrink: 0,
              }} />

              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "white", color: color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, flexShrink: 0,
                border: `1.5px solid ${color}`,
              }}>
                {w.nameTh[0]}
              </div>

              {/* Name + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{w.nameTh}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {w.nameEn}
                  {w.isTemporary && (
                    <span style={{ marginLeft: 6, background: "#F3F4F6", padding: "1px 5px", borderRadius: 4, fontSize: 10 }}>
                      ชั่วคราว
                    </span>
                  )}
                </div>
              </div>

              {/* Right: days worked + status */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color }}>
                  {isRed ? "72h+" : "ไม่มา"}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {w.daysWorked30d} วัน/30d
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Absence marking modal */}
      {marking && (() => {
        const worker = workers.find((w) => w.workerId === marking.workerId);
        if (!worker) return null;
        return (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              background: "white", borderRadius: 16, padding: 24,
              width: 340, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{worker.nameTh}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{worker.nameEn}</div>
                </div>
                <button
                  onClick={() => setMarking(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-muted)" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "var(--text-secondary)" }}>
                สาเหตุที่ไม่มา · Absence reason
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                {ABSENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setMarking((m) => m ? { ...m, reason: opt.value } : null)}
                    style={{
                      padding: "10px 8px",
                      border: `2px solid ${marking.reason === opt.value ? opt.color : "#E5E7EB"}`,
                      borderRadius: 10,
                      background: marking.reason === opt.value ? opt.color + "15" : "white",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: marking.reason === opt.value ? opt.color : "var(--text-primary)" }}>
                      {opt.labelTh}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{opt.labelEn}</div>
                  </button>
                ))}
              </div>

              <textarea
                placeholder="หมายเหตุ (ไม่บังคับ) · Note (optional)"
                value={marking.note}
                onChange={(e) => setMarking((m) => m ? { ...m, note: e.target.value } : null)}
                rows={2}
                style={{
                  width: "100%", padding: "9px 12px", fontSize: 14,
                  border: "1px solid #E5E7EB", borderRadius: 8, resize: "none",
                  marginBottom: 14, outline: "none", fontFamily: "inherit",
                }}
              />

              <button
                onClick={saveAbsence}
                disabled={!marking.reason || marking.saving}
                style={{
                  width: "100%", padding: "12px",
                  background: marking.reason ? "linear-gradient(135deg,#6C5CE7,#4F46E5)" : "#E5E7EB",
                  color: marking.reason ? "white" : "var(--text-muted)",
                  border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600,
                  cursor: marking.reason ? "pointer" : "not-allowed",
                }}
              >
                {marking.saving ? "กำลังบันทึก..." : "บันทึก · Save"}
              </button>
            </div>
          </div>
        );
      })()}
    </>
  );
}
