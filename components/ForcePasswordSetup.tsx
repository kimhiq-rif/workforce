"use client";
// Copyright © 2026 Workforce. All rights reserved.
import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";

export function ForcePasswordSetup() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (done) return null;

  async function handleSubmit() {
    setError("");
    if (password.length < 8) { setError("อย่างน้อย 8 ตัวอักษร · At least 8 characters"); return; }
    if (password !== confirm) { setError("รหัสผ่านไม่ตรงกัน · Passwords do not match"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/user/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Error"); return; }
      setDone(true);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "white", borderRadius: 20, padding: "36px 32px",
        width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <KeyRound size={28} color="var(--brand-primary, #6C5CE7)" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
            <span style={{ display: "block" }}>ตั้งรหัสผ่าน</span>
            <span style={{ display: "block", fontSize: 15, fontWeight: 500, color: "#6B7280", marginTop: 4 }}>Set your password</span>
          </h2>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 10, lineHeight: 1.5 }}>
            ยินดีต้อนรับ! กรุณาตั้งรหัสผ่านก่อนเริ่มใช้งาน
            <br />
            <em>Welcome! Please set a password to get started.</em>
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>รหัสผ่านใหม่ · New password</span>
            <div style={{ position: "relative" }}>
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร · Min 8 characters"
                style={{ width: "100%", padding: "11px 40px 11px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 15, boxSizing: "border-box" }}
                autoFocus
              />
              <button type="button" onClick={() => setShow(v => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 2 }}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>ยืนยันรหัสผ่าน · Confirm</span>
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="พิมพ์อีกครั้ง · Repeat password"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{ padding: "11px 12px", border: `1px solid ${confirm && confirm !== password ? "#EF4444" : "#E5E7EB"}`, borderRadius: 10, fontSize: 15 }}
            />
            {confirm && confirm !== password && (
              <span style={{ fontSize: 12, color: "#EF4444" }}>รหัสผ่านไม่ตรงกัน · Passwords do not match</span>
            )}
          </label>

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#B91C1C" }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving || !password || !confirm}
            style={{
              padding: "13px", background: "var(--brand-primary, #6C5CE7)", color: "white",
              border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
              cursor: saving || !password || !confirm ? "not-allowed" : "pointer",
              opacity: saving || !password || !confirm ? 0.6 : 1,
              marginTop: 4,
            }}
          >
            {saving ? "กำลังบันทึก… · Saving…" : "ยืนยัน · Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
