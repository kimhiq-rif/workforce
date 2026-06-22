"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Shows a dismissible banner prompting the user to enable notifications.
// The permission request runs from this button's click — required by iOS, which
// only allows the prompt from a user gesture inside an installed PWA.

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { oneSignal, enablePush, ONESIGNAL_APP_ID } from "@/lib/onesignal";

export function EnablePushPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ONESIGNAL_APP_ID) return;
    oneSignal((OneSignal: any) => {
      try {
        const granted = OneSignal.Notifications.permission; // boolean
        const supported = OneSignal.Notifications.isPushSupported?.() ?? true;
        if (supported && !granted) setShow(true);
        OneSignal.Notifications.addEventListener("permissionChange", (perm: boolean) => {
          setShow(!perm);
        });
      } catch {
        /* SDK not ready / unsupported — keep hidden */
      }
    });
  }, []);

  if (!show) return null;

  async function onEnable() {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    if (result === "granted") setShow(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 80, // above the bottom nav
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(92vw, 440px)",
        zIndex: 99998,
        background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
        boxShadow: "0 6px 24px rgba(30,58,138,0.4)",
        borderRadius: 14,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 9, padding: 8, flexShrink: 0 }}>
        <Bell size={20} color="white" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "white", lineHeight: 1.2 }}>
          เปิดการแจ้งเตือน · Enable notifications
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.88)", marginTop: 3, lineHeight: 1.4 }}>
          รับแจ้งเตือนการเข้างานและใบเสร็จ · Get attendance &amp; receipt alerts
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
        <button
          onClick={onEnable}
          disabled={busy}
          style={{
            background: "rgba(255,255,255,0.25)",
            border: "none",
            borderRadius: 8,
            padding: "7px 13px",
            fontSize: 12,
            fontWeight: 700,
            color: "white",
            cursor: busy ? "default" : "pointer",
            whiteSpace: "nowrap",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "..." : "เปิด · Enable"}
        </button>
        <button
          onClick={() => setShow(false)}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.32)",
            borderRadius: 8,
            padding: "5px 10px",
            fontSize: 11,
            color: "rgba(255,255,255,0.72)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <X size={11} /> ภายหลัง · Later
        </button>
      </div>
    </div>
  );
}
