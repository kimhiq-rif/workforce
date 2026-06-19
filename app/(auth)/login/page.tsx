"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Lock } from "lucide-react";

function WorkforceLogo({ size = 56 }: { size?: number }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* W strokes */}
      <path d="M6 14L13 36L22 22" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M28 22L37 36L44 14" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Pin teardrop */}
      <path d="M28 12C23.5 12 19.5 16 19.5 20.8C19.5 27.2 28 38 28 38C28 38 36.5 27.2 36.5 20.8C36.5 16 32.5 12 28 12Z" fill="#FF6A00"/>
      {/* Clock face */}
      <circle cx="28" cy="21" r="5.5" fill="white"/>
      <line x1="28" y1="21" x2="28" y2="17.5" stroke="#FF6A00" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="28" y1="21" x2="31" y2="22.5" stroke="#FF6A00" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;

    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setLoading(false);
      const next = attempts + 1;
      setAttempts(next);
      if (next >= 3) {
        setLocked(true);
        setError("ป้อนรหัสผ่านผิด 3 ครั้ง · Account locked for 15 minutes");
        setTimeout(() => { setLocked(false); setAttempts(0); setError(""); }, 15 * 60 * 1000);
      } else {
        setError(`รหัสผ่านไม่ถูกต้อง (${next}/3) · Invalid password (${next}/3)`);
      }
      return;
    }

    const bootstrapResponse = await fetch("/api/auth/bootstrap", { method: "POST" });
    if (!bootstrapResponse.ok) {
      const result = await bootstrapResponse.json();
      setLoading(false);
      setError(result.error ?? "Could not connect this account to an app owner profile");
      return;
    }

    setLoading(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      // Brand gradient — matches the header background in the brand reference
      background: "linear-gradient(160deg, #ddd6fe 0%, #c4b5fd 25%, #ede9fe 55%, #f5f0ff 75%, #fff8f3 100%)",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Decorative orbs — match the soft brand gradient */}
      <div style={{
        position: "absolute", top: "-120px", right: "-80px",
        width: 380, height: 380, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(109,40,217,0.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-100px", left: "-60px",
        width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,106,0,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Card */}
      <div style={{
        position: "relative",
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: 24,
        padding: "44px 40px 36px",
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 8px 48px rgba(109,40,217,0.14), 0 2px 12px rgba(0,0,0,0.07)",
        border: "1px solid rgba(196,181,253,0.5)",
      }}>

        {/* Logo block */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 36 }}>
          {/* Icon badge — same gradient as app icon */}
          <div style={{
            width: 80, height: 80,
            borderRadius: 22,
            background: "linear-gradient(145deg, #1E3A8A 0%, #3730A3 45%, #5B21B6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(30,58,138,0.35), 0 2px 8px rgba(91,33,182,0.2)",
            marginBottom: 18,
          }}>
            <WorkforceLogo size={52} />
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px",
              color: "#1E3A8A",
              lineHeight: 1.1,
            }}>
              Workforce
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
              color: "#FF6A00",
              marginTop: 4,
              textTransform: "uppercase",
            }}>
              ── Driven by Proof ──
            </div>
          </div>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
            เข้าสู่ระบบ
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280" }}>Sign in to your account</p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FECACA",
            borderRadius: 10, padding: "10px 14px", marginBottom: 16,
            fontSize: 14, color: "#B91C1C",
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>อีเมล · Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={locked}
              style={{
                border: "1.5px solid #DDD6FE",
                borderRadius: 10,
                padding: "11px 14px",
                fontSize: 15,
                outline: "none",
                width: "100%",
                background: locked ? "#F5F3FF" : "white",
                color: "#111827",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => e.target.style.borderColor = "#7C3AED"}
              onBlur={(e) => e.target.style.borderColor = "#DDD6FE"}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>รหัสผ่าน · Password</span>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={locked}
                style={{
                  border: "1.5px solid #DDD6FE",
                  borderRadius: 10,
                  padding: "11px 44px 11px 14px",
                  fontSize: 15,
                  outline: "none",
                  width: "100%",
                  background: locked ? "#F5F3FF" : "white",
                  color: "#111827",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => e.target.style.borderColor = "#7C3AED"}
                onBlur={(e) => e.target.style.borderColor = "#DDD6FE"}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "#9CA3AF", padding: 0, display: "flex",
                }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || locked}
            style={{
              marginTop: 8,
              padding: "13px",
              borderRadius: 12,
              border: "none",
              cursor: locked ? "not-allowed" : "pointer",
              opacity: locked ? 0.55 : 1,
              background: locked
                ? "#9CA3AF"
                : "linear-gradient(135deg, #1E3A8A 0%, #3730A3 50%, #5B21B6 100%)",
              color: "white",
              fontSize: 15,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: locked ? "none" : "0 4px 20px rgba(30,58,138,0.35)",
              transition: "opacity 0.15s, box-shadow 0.15s",
              letterSpacing: "0.01em",
            }}
          >
            {loading ? (
              <span style={{ opacity: 0.8 }}>กำลังเข้าสู่ระบบ… · Signing in…</span>
            ) : locked ? (
              <><Lock size={16} /> ถูกล็อก · Locked</>
            ) : (
              "เข้าสู่ระบบ · Sign in"
            )}
          </button>
        </form>

        <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", marginTop: 22 }}>
          ลืมรหัส? ติดต่อ Technical Admin · Forgot? Contact Technical Admin
        </p>
      </div>
    </div>
  );
}
