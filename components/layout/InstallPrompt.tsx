"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Shows "Add to Home Screen" prompt after login — iOS instruction banner or Android native prompt

import { useEffect, useState } from "react";
import { X, Share, Plus } from "lucide-react";

const DISMISSED_KEY = "wf_install_dismissed";

type IOSBanner = { type: "ios" };
type AndroidBanner = { type: "android"; prompt: () => Promise<void> };
type BannerState = IOSBanner | AndroidBanner | null;

export function InstallPrompt() {
  const [banner, setBanner]   = useState<BannerState>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed as PWA — don't show
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Already dismissed this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);

    if (isIOS) {
      // Small delay so the login animation finishes first
      setTimeout(() => {
        setBanner({ type: "ios" });
        setVisible(true);
      }, 1500);
      return;
    }

    if (isAndroid) {
      // Capture the beforeinstallprompt event
      const handler = (e: Event) => {
        e.preventDefault();
        const deferredPrompt = e as any;
        setTimeout(() => {
          setBanner({
            type: "android",
            prompt: async () => {
              deferredPrompt.prompt();
              const { outcome } = await deferredPrompt.userChoice;
              if (outcome === "accepted") dismiss();
            },
          });
          setVisible(true);
        }, 1500);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setTimeout(() => setBanner(null), 400);
  }

  if (!banner) return null;

  return (
    <>
      {/* Backdrop blur on iOS */}
      {banner.type === "ios" && visible && (
        <div
          onClick={dismiss}
          style={{ position: "fixed", inset: 0, zIndex: 1099, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }}
        />
      )}

      <div
        style={{
          position: "fixed",
          bottom: banner.type === "ios" ? "auto" : 80,
          top: banner.type === "ios" ? "auto" : undefined,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1100,
          width: "min(94vw, 420px)",
          background: "white",
          borderRadius: banner.type === "ios" ? "20px 20px 0 0" : 16,
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18), 0 2px 12px rgba(0,0,0,0.08)",
          padding: "20px 20px 28px",
          transition: "opacity 0.3s, transform 0.3s",
          opacity: visible ? 1 : 0,
          ...(banner.type === "ios" ? {
            bottom: 0,
            top: "auto",
            borderRadius: "20px 20px 0 0",
          } : {}),
        }}
      >
        {/* Handle bar */}
        <div style={{ width: 36, height: 4, background: "#E5E7EB", borderRadius: 2, margin: "0 auto 18px" }} />

        <button
          onClick={dismiss}
          style={{ position: "absolute", top: 14, right: 14, background: "#F3F4F6", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <X size={15} color="#6B7280" />
        </button>

        {/* App icon + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, overflow: "hidden", flexShrink: 0, boxShadow: "0 2px 8px rgba(30,58,138,0.25)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/icon/52" width={52} height={52} alt="Workforce" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>Workforce</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Driven by Proof</div>
          </div>
        </div>

        {banner.type === "ios" ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
              เพิ่มที่หน้าจอหลัก · Add to Home Screen
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.55, marginBottom: 18 }}>
              เพื่อประสบการณ์ที่ดีที่สุด เปิดแอปจากหน้าจอหลักเสมอ<br />
              For the best experience, always open from your Home Screen
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { n: "1", icon: <Share size={17} color="#007AFF" />, th: "กด", en: "Tap the", highlight: "Share", end_th: "ด้านล่าง", end_en: "button below" },
                { n: "2", icon: <Plus size={17} color="#007AFF" />, th: "เลือก", en: "Select", highlight: "Add to Home Screen", end_th: "", end_en: "" },
              ].map(({ n, icon, th, en, highlight, end_th, end_en }) => (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, background: "#F9FAFB", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1E3A8A", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{n}</div>
                  <div style={{ fontSize: 13, flex: 1 }}>
                    <span style={{ color: "#374151" }}>{th} </span>
                    <strong style={{ color: "#007AFF" }}>{highlight}</strong>
                    {end_th && <span style={{ color: "#374151" }}> {end_th}</span>}
                    <span style={{ display: "block", color: "#9CA3AF", fontSize: 12 }}>{en} <strong style={{ color: "#007AFF" }}>{highlight}</strong> {end_en}</span>
                  </div>
                  {icon}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, fontSize: 12, color: "#92400E" }}>
              ⚠️ ทำงานได้ดีที่สุดเมื่อเปิดจากหน้าจอหลัก — ไม่ใช่จาก Safari<br />
              Works best when opened from Home Screen, not from Safari
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
              ติดตั้งแอป · Install App
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16, lineHeight: 1.5 }}>
              เพิ่มลงหน้าจอหลักเพื่อเข้าถึงได้ทันที<br />
              Add to your Home Screen for instant access
            </div>
            <button
              onClick={async () => { if (banner.type === "android") await banner.prompt(); }}
              style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #1E3A8A, #5B21B6)", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Plus size={18} /> ติดตั้ง · Install
            </button>
          </>
        )}
      </div>
    </>
  );
}
