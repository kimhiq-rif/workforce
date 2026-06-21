"use client";

import { useState, useRef, useEffect } from "react";
import { X, Lock, AlertTriangle } from "lucide-react";

interface Props {
  workerNameTh: string;
  workerNameEn: string;
  currentWage: number;
  dailyWage: number;
  attendanceId: string;
  onSuccess: (newWage: number) => void;
  onClose: () => void;
}

export function HalfDayModal({
  workerNameTh, workerNameEn,
  currentWage, dailyWage,
  attendanceId,
  onSuccess, onClose,
}: Props) {
  const [code, setCode]       = useState("");
  const [note, setNote]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const halfWage = Math.round(dailyWage / 2);
  const cut      = currentWage - halfWage;

  async function confirm() {
    if (code.length < 4) { setError("הכנס לפחות 4 ספרות · Minimum 4 characters"); return; }
    setLoading(true);
    setError("");
    const res  = await fetch("/api/attendance/half-day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId, adminCode: code, note: note || undefined }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      if (json.error === "no_code_set") setError("ยังไม่ได้ตั้งรหัส Admin — ตั้งก่อนใน Settings · Set Admin Code in Settings first");
      else if (json.error === "invalid_code") setError("รหัสไม่ถูกต้อง · Incorrect admin code");
      else setError(json.message ?? "Error");
      return;
    }
    onSuccess(json.newWage);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "white", borderRadius: 18, padding: 28,
        width: 360, maxWidth: "92vw",
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={16} color="#D97706" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#D97706", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                ครึ่งวัน · Half Day
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{workerNameTh}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{workerNameEn}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Wage impact */}
        <div style={{
          background: "#FFF7ED", border: "1px solid #FED7AA",
          borderRadius: 10, padding: "12px 14px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
            <span style={{ color: "var(--text-muted)" }}>ค่าแรงปัจจุบัน · Current</span>
            <span style={{ fontWeight: 600 }}>฿{currentWage.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
            <span style={{ color: "var(--text-muted)" }}>หลังครึ่งวัน · After half day</span>
            <span style={{ fontWeight: 600, color: "#D97706" }}>฿{halfWage.toLocaleString()}</span>
          </div>
          <div style={{ borderTop: "1px solid #FED7AA", paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700 }}>
            <span style={{ color: "#9A3412" }}>หักออก · Deducted</span>
            <span style={{ color: "#DC2626" }}>-฿{cut.toLocaleString()}</span>
          </div>
        </div>

        {/* Note */}
        <input
          placeholder="สาเหตุ (ไม่บังคับ) · Reason (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{
            width: "100%", padding: "9px 12px", fontSize: 14,
            border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 12,
            outline: "none", fontFamily: "inherit",
          }}
        />

        {/* Admin code input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 7, color: "var(--text-secondary)" }}>
            <Lock size={14} color="#6C5CE7" />
            รหัส Admin · Admin code
          </label>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            placeholder="••••"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
            style={{
              width: "100%", padding: "11px 14px", fontSize: 22,
              letterSpacing: 8, textAlign: "center",
              border: `2px solid ${error ? "#EF4444" : "#6C5CE7"}`,
              borderRadius: 10, outline: "none",
              fontFamily: "monospace",
            }}
          />
          {error && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#EF4444", display: "flex", gap: 5 }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}
        </div>

        {/* Confirm button */}
        <button
          onClick={confirm}
          disabled={loading || code.length < 4}
          style={{
            width: "100%", padding: 14,
            background: code.length >= 4 && !loading ? "linear-gradient(135deg,#6C5CE7,#4F46E5)" : "#E5E7EB",
            color: code.length >= 4 && !loading ? "white" : "var(--text-muted)",
            border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700,
            cursor: code.length >= 4 && !loading ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "กำลังยืนยัน..." : "ยืนยันครึ่งวัน · Confirm Half Day"}
        </button>
      </div>
    </div>
  );
}
