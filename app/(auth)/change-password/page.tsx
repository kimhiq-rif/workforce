"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, Eye, EyeOff, HardHat } from "lucide-react";

export default function ChangePasswordPage() {
  const router  = useRouter();
  const supabase = createClient();
  const [newPw, setNewPw]       = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [authed, setAuthed]     = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
      else setAuthed(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 8) { setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร · Minimum 8 characters"); return; }
    if (newPw !== confirm) { setError("รหัสผ่านไม่ตรงกัน · Passwords don't match"); return; }

    setSaving(true);
    setError("");

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
    if (updateErr) { setError(updateErr.message); setSaving(false); return; }

    // Clear the must_change_password flag
    await fetch("/api/auth/clear-force-change", { method: "POST" });

    router.push("/");
    router.refresh();
  }

  if (!authed) return null;

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
      background: "linear-gradient(160deg, #ddd6fe 0%, #c4b5fd 25%, #ede9fe 55%, #f5f0ff 75%, #fff8f3 100%)",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.90)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        borderRadius: 24, padding: "44px 40px 36px", width: "100%", maxWidth: 420,
        boxShadow: "0 8px 48px rgba(109,40,217,0.14)", border: "1px solid rgba(196,181,253,0.5)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: "linear-gradient(145deg, #1E3A8A 0%, #5B21B6 100%)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 14, boxShadow: "0 6px 24px rgba(30,58,138,0.3)",
          }}>
            <Lock size={30} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
            ตั้งรหัสผ่านใหม่
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280" }}>
            Set your new password · กรุณาตั้งรหัสผ่านส่วนตัวของคุณ
          </p>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 14, color: "#B91C1C" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>รหัสผ่านใหม่ · New password</span>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร · 8+ characters"
                required
                style={{ border: "1.5px solid #DDD6FE", borderRadius: 10, padding: "11px 44px 11px 14px", fontSize: 15, outline: "none", width: "100%", color: "#111827" }}
                onFocus={(e) => e.target.style.borderColor = "#7C3AED"}
                onBlur={(e)  => e.target.style.borderColor = "#DDD6FE"}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex" }}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>ยืนยันรหัสผ่าน · Confirm</span>
            <input
              type={showPw ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              style={{ border: "1.5px solid #DDD6FE", borderRadius: 10, padding: "11px 14px", fontSize: 15, outline: "none", width: "100%", color: "#111827" }}
              onFocus={(e) => e.target.style.borderColor = "#7C3AED"}
              onBlur={(e)  => e.target.style.borderColor = "#DDD6FE"}
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: 8, padding: "13px", borderRadius: 12, border: "none",
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              background: "linear-gradient(135deg, #1E3A8A 0%, #3730A3 50%, #5B21B6 100%)",
              color: "white", fontSize: 15, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 20px rgba(30,58,138,0.35)",
            }}
          >
            {saving ? "กำลังบันทึก…" : "บันทึกรหัสผ่าน · Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}
