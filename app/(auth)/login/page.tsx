"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Lock, HardHat, Fingerprint } from "lucide-react";

function WorkforceLogo({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 13L15 44L25 26" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M31 26L41 44L51 13" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M28 6C22 6 17 11 17 17C17 25 28 36 28 36C28 36 39 25 39 17C39 11 34 6 28 6Z" fill="#FF6A00"/>
      <circle cx="28" cy="17" r="6" fill="white"/>
      <line x1="28" y1="17" x2="28" y2="12.5" stroke="#FF6A00" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="28" y1="17" x2="32" y2="19" stroke="#FF6A00" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

// ── Biometric button ──────────────────────────────────────────────────────────

function BiometricLoginButton({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleBiometric() {
    setLoading(true);
    setError("");
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const supabase = createClient();

      // Get options from server
      const optRes = await fetch("/api/passkey/authenticate", { method: "POST" });
      if (!optRes.ok) throw new Error("Server error");
      const options = await optRes.json();

      // Trigger Face ID / fingerprint
      const assertion = await startAuthentication({ optionsJSON: options });

      // Verify on server → get token_hash
      const verRes = await fetch("/api/passkey/authenticate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });
      if (!verRes.ok) {
        const j = await verRes.json();
        throw new Error(j.error ?? "Auth failed");
      }
      const { email, token_hash } = await verRes.json();

      // Exchange token for Supabase session
      const { error: authError } = await supabase.auth.verifyOtp({
        email,
        token: token_hash,
        type: "magiclink",
      });
      if (authError) throw new Error(authError.message);

      await fetch("/api/auth/bootstrap", { method: "POST" });
      onSuccess();
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("ยกเลิก · Cancelled");
      } else {
        setError(err.message ?? "Biometric error");
      }
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        onClick={handleBiometric}
        disabled={loading}
        style={{
          width: "100%", padding: "13px",
          borderRadius: 12, border: "2px solid #1E3A8A",
          background: "white", color: "#1E3A8A",
          fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          transition: "all 0.15s",
        }}
      >
        <Fingerprint size={22} />
        {loading ? "กำลังยืนยัน…" : "Face ID / ลายนิ้วมือ · Biometric Login"}
      </button>
      {error && (
        <div style={{ fontSize: 12, color: "#B91C1C", textAlign: "center" }}>{error}</div>
      )}
    </div>
  );
}

// ── Enable passkey prompt (shown once after email+password login) ─────────────

function EnablePasskeyPrompt({ onDone }: { onDone: () => void }) {
  const [step, setStep]     = useState<"ask" | "registering" | "done" | "error">("ask");
  const [errMsg, setErrMsg] = useState("");

  async function handleEnable() {
    setStep("registering");
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");

      const optRes = await fetch("/api/passkey/register", { method: "POST" });
      if (!optRes.ok) throw new Error("Server error");
      const options = await optRes.json();

      const deviceName = /iPhone|iPad/.test(navigator.userAgent) ? "Face ID" : "Fingerprint";
      const attReg = await startRegistration({ optionsJSON: options });

      const verRes = await fetch("/api/passkey/register", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...attReg, deviceName }),
      });
      if (!verRes.ok) {
        const j = await verRes.json();
        throw new Error(j.error ?? "Registration failed");
      }

      setStep("done");
      setTimeout(onDone, 1200);
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        onDone(); // user cancelled — just proceed
      } else {
        setErrMsg(err.message ?? "Error");
        setStep("error");
      }
    }
  }

  if (step === "done") {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#15803D" }}>
          เปิดใช้งานแล้ว · Enabled
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {step === "error" && (
        <div style={{ background: "#FEF2F2", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#B91C1C" }}>
          {errMsg}
        </div>
      )}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>
          {/iPhone|iPad/.test(typeof navigator !== "undefined" ? navigator.userAgent : "") ? "🔒" : "👆"}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
          เปิดใช้ Face ID / ลายนิ้วมือ
        </div>
        <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
          Enable biometric login — next time you sign in with one tap
        </div>
      </div>
      <button
        onClick={handleEnable}
        disabled={step === "registering"}
        style={{
          padding: "13px", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg, #1E3A8A 0%, #FF6A00 100%)",
          color: "white", fontSize: 15, fontWeight: 700,
          cursor: step === "registering" ? "not-allowed" : "pointer",
        }}
      >
        {step === "registering" ? "กำลังลงทะเบียน…" : "เปิดใช้งาน · Enable"}
      </button>
      <button
        onClick={onDone}
        style={{ padding: "10px", borderRadius: 10, border: "1.5px solid #E5E7EB", background: "white", color: "#6B7280", fontSize: 14, cursor: "pointer" }}
      >
        ไม่ตอนนี้ · Not now
      </button>
    </div>
  );
}

// ── Main login page ───────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [attempts, setAttempts]   = useState(0);
  const [locked, setLocked]       = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [showEnablePrompt, setShowEnablePrompt] = useState(false);

  useEffect(() => {
    // Check if this device supports biometric (and has a passkey registered)
    if (typeof window === "undefined") return;
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
      .then((available) => {
        if (available) {
          // Check if user has any passkeys on server (quick GET, no session needed)
          // We show the button if biometric hardware is available — discovery handles the rest
          setHasBiometric(true);
        }
      })
      .catch(() => {});
  }, []);

  function handleBiometricSuccess() {
    router.push("/");
    router.refresh();
  }

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

    // Offer biometric enrollment if supported and not yet enrolled
    if (hasBiometric) {
      const { count } = await fetch("/api/passkey/register").then((r) => r.json()).catch(() => ({ count: 1 }));
      if (count === 0) {
        setShowEnablePrompt(true);
        return;
      }
    }

    router.push("/");
    router.refresh();
  }

  // ── Enable passkey prompt overlay ────────────────────────────────────────────
  if (showEnablePrompt) {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
        background: "linear-gradient(160deg, #ddd6fe 0%, #c4b5fd 25%, #ede9fe 55%, #f5f0ff 75%, #fff8f3 100%)",
      }}>
        <div style={{
          background: "rgba(255,255,255,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          borderRadius: 24, padding: "40px 32px", width: "100%", maxWidth: 380,
          boxShadow: "0 8px 48px rgba(109,40,217,0.14)",
          border: "1px solid rgba(196,181,253,0.5)",
        }}>
          <EnablePasskeyPrompt onDone={() => { router.push("/"); router.refresh(); }} />
        </div>
      </div>
    );
  }

  // ── Login form ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
      background: "linear-gradient(160deg, #ddd6fe 0%, #c4b5fd 25%, #ede9fe 55%, #f5f0ff 75%, #fff8f3 100%)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: "-120px", right: "-80px", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(109,40,217,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-100px", left: "-60px", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,106,0,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{
        position: "relative", background: "rgba(255,255,255,0.88)", backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)", borderRadius: 24, padding: "44px 40px 36px",
        width: "100%", maxWidth: 420,
        boxShadow: "0 8px 48px rgba(109,40,217,0.14), 0 2px 12px rgba(0,0,0,0.07)",
        border: "1px solid rgba(196,181,253,0.5)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 36 }}>
          <div style={{ width: 80, height: 80, borderRadius: 22, background: "linear-gradient(145deg, #1E3A8A 0%, #3730A3 45%, #5B21B6 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(30,58,138,0.35)", marginBottom: 18 }}>
            <WorkforceLogo size={52} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: "#1E3A8A", lineHeight: 1.1 }}>Workforce</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#FF6A00", marginTop: 5 }}>
              <HardHat size={13} strokeWidth={2} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>Driven by Proof</span>
              <HardHat size={13} strokeWidth={2} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 2 }}>เข้าสู่ระบบ</h1>
          <p style={{ fontSize: 13, color: "#6B7280" }}>Sign in to your account</p>
        </div>

        {/* Biometric button — shown if hardware is available */}
        {hasBiometric && (
          <div style={{ marginBottom: 20 }}>
            <BiometricLoginButton onSuccess={handleBiometricSuccess} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 0" }}>
              <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>หรือ · or</span>
              <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 14, color: "#B91C1C" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>อีเมล · Email</span>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" required disabled={locked}
              style={{ border: "1.5px solid #DDD6FE", borderRadius: 10, padding: "11px 14px", fontSize: 15, outline: "none", width: "100%", background: locked ? "#F5F3FF" : "white", color: "#111827", transition: "border-color 0.15s" }}
              onFocus={(e) => e.target.style.borderColor = "#7C3AED"}
              onBlur={(e)  => e.target.style.borderColor = "#DDD6FE"}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>รหัสผ่าน · Password</span>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"} value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required disabled={locked}
                style={{ border: "1.5px solid #DDD6FE", borderRadius: 10, padding: "11px 44px 11px 14px", fontSize: 15, outline: "none", width: "100%", background: locked ? "#F5F3FF" : "white", color: "#111827", transition: "border-color 0.15s" }}
                onFocus={(e) => e.target.style.borderColor = "#7C3AED"}
                onBlur={(e)  => e.target.style.borderColor = "#DDD6FE"}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 0, display: "flex" }}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <button
            type="submit" disabled={loading || locked}
            style={{
              marginTop: 8, padding: "13px", borderRadius: 12, border: "none",
              cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.55 : 1,
              background: locked ? "#9CA3AF" : "linear-gradient(135deg, #1E3A8A 0%, #3730A3 50%, #5B21B6 100%)",
              color: "white", fontSize: 15, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: locked ? "none" : "0 4px 20px rgba(30,58,138,0.35)",
              transition: "opacity 0.15s, box-shadow 0.15s", letterSpacing: "0.01em",
            }}
          >
            {loading ? <span style={{ opacity: 0.8 }}>กำลังเข้าสู่ระบบ… · Signing in…</span>
              : locked ? <><Lock size={16} /> ถูกล็อก · Locked</>
              : "เข้าสู่ระบบ · Sign in"}
          </button>
        </form>

        <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", marginTop: 22 }}>
          ลืมรหัส? ติดต่อ Technical Admin · Forgot? Contact Technical Admin
        </p>
      </div>
    </div>
  );
}
