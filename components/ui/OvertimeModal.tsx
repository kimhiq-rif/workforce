"use client";

import { useState } from "react";
import { X, Clock, Check } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface WorkerEntry {
  id: string;
  name_th: string;
  name_en: string;
  daily_wage: number;
}

interface OvertimeModalProps {
  siteId: string;
  siteName: string;
  eventDate: string;
  reportedWorkers: WorkerEntry[];
  onClose: () => void;
  onSaved: () => void;
}

function computeHours(endTime: string): number {
  const [h, m] = endTime.split(":").map(Number);
  return Math.max(0, (h - 17) + m / 60);
}

function defaultAmount(worker: WorkerEntry, endTime: string): number {
  const hours = computeHours(endTime);
  if (hours <= 0) return 0;
  const hourlyRate = worker.daily_wage / 9; // 08:00–17:00 = 9h
  return Math.round(hourlyRate * hours * 2); // 100% extra = ×2
}

export function OvertimeModal({
  siteId,
  siteName,
  eventDate,
  reportedWorkers,
  onClose,
  onSaved,
}: OvertimeModalProps) {
  const [endTime, setEndTime] = useState("19:00");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(reportedWorkers.map((w) => w.id)));
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const w of reportedWorkers) {
      init[w.id] = String(defaultAmount(w, "19:00"));
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hours = computeHours(endTime);
  const selectedList = reportedWorkers.filter((w) => selected.has(w.id));
  const totalAmount = selectedList.reduce((sum, w) => sum + (parseFloat(amounts[w.id]) || 0), 0);

  function toggleWorker(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleEndTimeChange(val: string) {
    setEndTime(val);
    setAmounts((prev) => {
      const next = { ...prev };
      for (const w of reportedWorkers) {
        next[w.id] = String(defaultAmount(w, val));
      }
      return next;
    });
  }

  // remindLater = save the session now but leave amounts empty; the owner gets
  // an 08:30 reminder and completes the cost later from Needs Attention.
  async function submit(remindLater: boolean) {
    setError("");
    if (selectedList.length === 0) { setError("เลือกอย่างน้อย 1 คน · Select at least 1 worker"); return; }
    if (hours <= 0) { setError("เวลาสิ้นสุดต้องหลัง 17:00 · End time must be after 17:00"); return; }

    if (!remindLater) {
      const missingAmount = selectedList.find((w) => !parseFloat(amounts[w.id]));
      if (missingAmount) {
        setError(`กรุณากรอกจำนวนเงินของ ${missingAmount.name_th} · Enter amount for ${missingAmount.name_en}`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/overtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          eventDate,
          overtimeEndTime: endTime,
          entries: selectedList.map((w) => ({
            workerId: w.id,
            amount: remindLater ? null : parseFloat(amounts[w.id]),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "เกิดข้อผิดพลาด · Error"); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "0 0 0 0",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: "#FFF7ED", borderRadius: 10, padding: 8 }}>
            <Clock size={22} color="#EA580C" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>ล่วงเวลา · Overtime</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{siteName} · {eventDate}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={22} color="var(--text-muted)" />
          </button>
        </div>

        {/* End time input */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>เวลาสิ้นสุด · End time</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>เริ่มนับจาก 17:00 · Counted from 17:00</div>
          </div>
          <input
            type="time"
            value={endTime}
            min="17:01"
            max="23:59"
            onChange={(e) => handleEndTimeChange(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "2px solid var(--brand-primary)",
              borderRadius: 8,
              fontSize: 20,
              fontWeight: 700,
              color: "var(--brand-primary)",
              outline: "none",
              width: 130,
            }}
          />
        </div>

        {hours > 0 && (
          <div style={{ padding: "8px 20px", background: "#FFF7ED", borderBottom: "1px solid #FED7AA", fontSize: 13, color: "#C2410C", fontWeight: 600 }}>
            ⏱ {hours.toFixed(1)} ชั่วโมงล่วงเวลา · {hours.toFixed(1)} overtime hours (×2 rate)
          </div>
        )}

        {/* Worker list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {reportedWorkers.map((w) => {
            const isSelected = selected.has(w.id);
            return (
              <div
                key={w.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--border)",
                  opacity: isSelected ? 1 : 0.45,
                  transition: "opacity 0.15s",
                }}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleWorker(w.id)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: `2px solid ${isSelected ? "var(--brand-primary)" : "var(--border)"}`,
                    background: isSelected ? "var(--brand-primary)" : "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {isSelected && <Check size={16} color="white" strokeWidth={3} />}
                </button>

                {/* Avatar */}
                <div className="avatar" style={{ width: 36, height: 36, fontSize: 13, flexShrink: 0 }}>
                  {w.name_th[0]}
                </div>

                {/* Name */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{w.name_th}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{w.name_en} · ฿{formatCurrency(w.daily_wage)}/วัน</div>
                </div>

                {/* Amount input */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 14, color: "var(--text-muted)" }}>฿</span>
                  <input
                    type="number"
                    min="0"
                    value={amounts[w.id] ?? ""}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [w.id]: e.target.value }))}
                    disabled={!isSelected}
                    placeholder="0"
                    style={{
                      width: 80,
                      padding: "6px 8px",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      fontSize: 15,
                      fontWeight: 600,
                      textAlign: "right",
                      outline: "none",
                      background: isSelected ? "white" : "var(--surface)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 20px", borderTop: "1px solid var(--border)" }}>
          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#B91C1C", marginBottom: 10 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {selectedList.length} คน · workers
            </span>
            <strong style={{ fontSize: 17 }}>รวม ฿{formatCurrency(totalAmount)}</strong>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: "12px", borderRadius: 10, border: "1px solid var(--border)",
                background: "white", fontSize: 15, cursor: "pointer", fontWeight: 600,
              }}
            >
              ยกเลิก · Cancel
            </button>
            <button
              onClick={() => submit(false)}
              disabled={saving || selectedList.length === 0}
              style={{
                flex: 2, padding: "12px", borderRadius: 10, border: "none",
                background: selectedList.length === 0 ? "var(--border)" : "#EA580C",
                color: "white", fontSize: 15, fontWeight: 700, cursor: saving || selectedList.length === 0 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Clock size={18} />
              {saving ? "กำลังบันทึก…" : "ยืนยัน · Confirm Overtime"}
            </button>
          </div>

          {/* Remind me later — saves the session without amounts */}
          <button
            onClick={() => submit(true)}
            disabled={saving || selectedList.length === 0}
            style={{
              width: "100%", marginTop: 8, padding: "10px", borderRadius: 10,
              border: "1px dashed #FDBA74", background: "#FFF7ED",
              color: "#9A3412", fontSize: 13, fontWeight: 700,
              cursor: saving || selectedList.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            ⏰ ยังไม่ทราบจำนวนเงิน · เตือนฉันพรุ่งนี้ · I don't know the amount — remind me tomorrow
          </button>
        </div>
      </div>
    </div>
  );
}
