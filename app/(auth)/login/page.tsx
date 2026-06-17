"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Lock } from "lucide-react";

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
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setLoading(false);
      const next = attempts + 1;
      setAttempts(next);
      if (next >= 3) {
        setLocked(true);
        setError("ป้อนรหัสผ่านผิด 3 ครั้ง · Account locked for 15 minutes");
        setTimeout(() => {
          setLocked(false);
          setAttempts(0);
          setError("");
        }, 15 * 60 * 1000);
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
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--brand-primary)",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: "40px 36px",
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--brand-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            W
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
              Workforce
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
              DRIVEN BY PROOF
            </div>
          </div>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>เข้าสู่ระบบ</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28 }}>Sign in to your account</p>

        {error && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 14,
              color: "#B91C1C",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>อีเมล · Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={locked}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 15,
                outline: "none",
                width: "100%",
                background: locked ? "var(--surface)" : "white",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>รหัสผ่าน · Password</span>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={locked}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 44px 10px 14px",
                  fontSize: 15,
                  outline: "none",
                  width: "100%",
                  background: locked ? "var(--surface)" : "white",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 0,
                  display: "flex",
                }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading || locked}
            className="btn-primary"
            style={{
              justifyContent: "center",
              marginTop: 8,
              opacity: locked ? 0.5 : 1,
              cursor: locked ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              <span style={{ opacity: 0.7 }}>กำลังเข้าสู่ระบบ… · Signing in…</span>
            ) : locked ? (
              <span>
                <Lock size={16} style={{ display: "inline", marginRight: 6 }} />
                ถูกล็อก · Locked
              </span>
            ) : (
              "เข้าสู่ระบบ · Sign in"
            )}
          </button>
        </form>

        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 20 }}>
          ลืมรหัส? ติดต่อ Technical Admin · Forgot? Contact Technical Admin
        </p>
      </div>
    </div>
  );
}
