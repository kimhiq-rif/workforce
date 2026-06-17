"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useEffect, useState } from "react";
import { Bell, ChevronDown, LogIn, LogOut, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate, formatEnDate, nowBangkok } from "@/lib/format";

interface SystemBarProps {
  userInitials?: string;
  userName?: string;
  notificationCount?: number;
}

export function SystemBar({
  userInitials = "SK",
  userName = "เจ้าของ",
  notificationCount = 0,
}: SystemBarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [time, setTime] = useState(nowBangkok());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const now = new Date();

  useEffect(() => {
    const timer = setInterval(() => setTime(nowBangkok()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    supabase.auth.getUser().then(({ data }) => {
      setConnectedEmail(data.user?.email ?? null);
    });
  }, [drawerOpen, supabase.auth]);

  // Workday progress (07:00 - 17:00 = 600 min)
  const bangkokMinutes = (() => {
    const t = nowBangkok();
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  })();
  const workStart = 7 * 60;
  const workEnd = 17 * 60;
  const progress = Math.min(100, Math.max(0, ((bangkokMinutes - workStart) / (workEnd - workStart)) * 100));

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthLoading(false);
      setAuthError(error.message);
      return;
    }

    const bootstrapResponse = await fetch("/api/auth/bootstrap", { method: "POST" });
    if (!bootstrapResponse.ok) {
      const result = await bootstrapResponse.json();
      setAuthLoading(false);
      setAuthError(result.error ?? "Could not connect owner profile");
      return;
    }

    setAuthLoading(false);
    setConnectedEmail(email);
    setPassword("");
    setAuthSuccess("Owner connected successfully");
    router.refresh();
    setTimeout(() => setDrawerOpen(false), 900);
  }

  async function handleSignOut() {
    setAuthLoading(true);
    await supabase.auth.signOut();
    setAuthLoading(false);
    setConnectedEmail(null);
    setEmail("");
    setPassword("");
    setDrawerOpen(false);
    router.push("/login");
  }

  return (
    <header className="system-bar desktop-only">
      {/* Time card */}
      <div className="system-card">
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>เวลาในระบบ</div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>System time</div>
        </div>
        <div>
          <div className="system-time">{time}</div>
          <div className="system-date">{formatThaiDate(now)} | {formatEnDate(now)}</div>
        </div>
      </div>

      {/* Workday progress */}
      <div className="system-card" style={{ gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>ช่วงเวลางาน</div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Workday</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
            <span>07:00</span>
            <div className="workday-track" style={{ flex: 1, width: 100 }}>
              <div className="workday-fill" style={{ width: `${progress}%` }} />
            </div>
            <span>17:00</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, textAlign: "center" }}>{time}</div>
        </div>
      </div>

      {/* Daily reset */}
      <div className="system-card">
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>รีเซ็ตประจำวัน</div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Daily reset</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>00:00</div>
      </div>

      {/* Profile */}
      <div className="profile-area" style={{ position: "relative" }}>
        <button
          style={{
            position: "relative",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            color: "var(--text-primary)",
          }}
          aria-label="Notifications"
        >
          <Bell size={22} strokeWidth={1.8} />
          {notificationCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#EF4444",
                color: "white",
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {notificationCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setDrawerOpen((value) => !value)}
          style={{
            border: "none",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            color: "var(--text-primary)",
            padding: 0,
          }}
          aria-expanded={drawerOpen}
          aria-label="Owner account menu"
        >
          <div className="avatar">{userInitials}</div>
          <div style={{ textAlign: "left" }}>
            <strong style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{userName}</strong>
            <small style={{ fontSize: 11, color: "var(--text-muted)" }}>Owner</small>
          </div>
          <ChevronDown size={16} color="var(--text-muted)" />
        </button>

        {drawerOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              width: 320,
              background: "white",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "var(--shadow-popover)",
              zIndex: 60,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <strong style={{ display: "block", fontSize: 15 }}>Owner account</strong>
                <small style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  Connect or disconnect the owner session.
                </small>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
                aria-label="Close owner menu"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
              <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{userInitials}</div>
              <div>
                <strong style={{ display: "block", fontSize: 14 }}>{userName}</strong>
                <small style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {connectedEmail ? `Connected: ${connectedEmail}` : "No owner email loaded"}
                </small>
              </div>
            </div>

            {connectedEmail && (
              <div style={{ background: "#F0FDF4", color: "#15803D", borderRadius: 8, padding: "8px 10px", fontSize: 12, marginTop: 12, fontWeight: 600 }}>
                Connected owner session
              </div>
            )}

            <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Owner email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="owner@example.com"
                  autoComplete="email"
                  style={{ padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Password</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  style={{ padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
                />
              </label>
              {authError && (
                <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                  {authError}
                </div>
              )}
              {authSuccess && (
                <div style={{ background: "#F0FDF4", color: "#15803D", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                  {authSuccess}
                </div>
              )}
              <button
                className="btn-primary"
                disabled={authLoading || !email || !password}
                type="submit"
                style={{ justifyContent: "center" }}
              >
                <LogIn size={16} />
                {authLoading ? "Connecting..." : "Connect owner"}
              </button>
            </form>

            <button
              onClick={handleSignOut}
              disabled={authLoading}
              style={{
                marginTop: 10,
                width: "100%",
                padding: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 8,
                color: "#B91C1C",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <LogOut size={16} />
              Disconnect owner
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
