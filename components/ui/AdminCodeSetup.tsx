"use client";

import { useState } from "react";
import { Lock, CheckCircle, AlertTriangle } from "lucide-react";

export function AdminCodeSetup() {
  const [code, setCode]       = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState("");

  async function save() {
    setError("");
    if (code.length < 4) { setError("อย่างน้อย 4 หลัก · Minimum 4 digits"); return; }
    if (code !== confirm) { setError("รหัสไม่ตรงกัน · Codes do not match"); return; }
    setSaving(true);
    const res = await fetch("/api/owner/admin-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set", code }),
    });
    setSaving(false);
    if (!res.ok) { setError("เกิดข้อผิดพลาด · Error saving"); return; }
    setSuccess(true);
    setCode(""); setConfirm("");
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <div style={{
      background: "white", border: "1px solid #E5E7EB",
      borderRadius: 14, padding: "20px 22px", maxWidth: 400,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: "linear-gradient(135deg,#6C5CE7,#4F46E5)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Lock size={16} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>รหัส Admin</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Admin Code · Required for wage-cutting actions</div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
        รหัสนี้ใช้ยืนยันการตัดเงิน เช่น ครึ่งวัน
        <br />
        <span style={{ fontSize: 12 }}>Used to confirm wage-cutting decisions such as half-day.</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        <input
          type="password"
          inputMode="numeric"
          placeholder="รหัสใหม่ · New code"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(""); }}
          maxLength={8}
          style={{
            padding: "10px 14px", fontSize: 16, letterSpacing: 4, textAlign: "center",
            border: "1.5px solid #E5E7EB", borderRadius: 8, outline: "none",
            fontFamily: "monospace",
          }}
        />
        <input
          type="password"
          inputMode="numeric"
          placeholder="ยืนยันรหัส · Confirm code"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(""); }}
          maxLength={8}
          style={{
            padding: "10px 14px", fontSize: 16, letterSpacing: 4, textAlign: "center",
            border: `1.5px solid ${error ? "#EF4444" : "#E5E7EB"}`, borderRadius: 8, outline: "none",
            fontFamily: "monospace",
          }}
        />
      </div>

      {error && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", color: "#EF4444", fontSize: 13, marginBottom: 12 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      {success && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", color: "#22C55E", fontSize: 13, marginBottom: 12 }}>
          <CheckCircle size={14} /> บันทึกรหัสสำเร็จ · Admin code saved
        </div>
      )}

      <button
        onClick={save}
        disabled={saving || code.length < 4}
        style={{
          width: "100%", padding: "11px",
          background: code.length >= 4 ? "linear-gradient(135deg,#6C5CE7,#4F46E5)" : "#E5E7EB",
          color: code.length >= 4 ? "white" : "var(--text-muted)",
          border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600,
          cursor: code.length >= 4 ? "pointer" : "not-allowed",
        }}
      >
        {saving ? "กำลังบันทึก..." : "บันทึกรหัส · Save Code"}
      </button>
    </div>
  );
}
