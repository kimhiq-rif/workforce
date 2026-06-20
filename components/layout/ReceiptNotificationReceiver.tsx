"use client";
// Copyright © 2026 Workforce. All rights reserved.
// In-app receipt push notification — slides up from bottom like the toast system,
// blinks in brand colors, plays a repeating urgent chime.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, X } from "lucide-react";

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

// Urgent triple-beep (A5 → C6 → A5), repeats every 8 s for ≈30 s total.
function startReceiptChime(): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];

  function beep() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [880, 1047, 880].forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.2;
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.start(t);
        osc.stop(t + 0.28);
      });
    } catch {}
  }

  beep();
  [8_000, 16_000, 24_000].forEach((ms) => { timers.push(setTimeout(beep, ms)); });
  return () => timers.forEach(clearTimeout);
}

// Blink cycles through: blue → orange → blue…
const BLINK = [
  {
    bg:     "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
    shadow: "inset 0 3px 0 0 #FF6A00, 0 -2px 24px rgba(30,58,138,0.55), 0 6px 24px rgba(30,58,138,0.4)",
  },
  {
    bg:     "linear-gradient(135deg, #FF6A00 0%, #EA580C 100%)",
    shadow: "inset 0 3px 0 0 #1E3A8A, 0 -2px 24px rgba(255,106,0,0.55), 0 6px 24px rgba(255,106,0,0.4)",
  },
];

export function ReceiptNotificationReceiver() {
  const router = useRouter();
  const [note, setNote]       = useState<PushPayload | null>(null);
  const [blinkIdx, setBlinkIdx] = useState(0);
  const cancelChimeRef  = useRef<(() => void) | null>(null);
  const autoHideRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    function handleMsg(event: MessageEvent) {
      const msg = event.data;
      if (msg?.type !== "WF_PUSH" || msg.payload?.tag !== "new_receipt") return;

      cancelChimeRef.current?.();
      if (autoHideRef.current)   clearTimeout(autoHideRef.current);
      if (blinkTimerRef.current) clearInterval(blinkTimerRef.current);

      setNote(msg.payload as PushPayload);
      setBlinkIdx(0);

      cancelChimeRef.current = startReceiptChime();

      let idx = 0;
      blinkTimerRef.current = setInterval(() => { idx = (idx + 1) % BLINK.length; setBlinkIdx(idx); }, 700);

      autoHideRef.current = setTimeout(dismiss, 30_000);
    }

    navigator.serviceWorker.addEventListener("message", handleMsg);
    return () => navigator.serviceWorker.removeEventListener("message", handleMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    cancelChimeRef.current?.();
    cancelChimeRef.current = null;
    if (autoHideRef.current)   clearTimeout(autoHideRef.current);
    if (blinkTimerRef.current) clearInterval(blinkTimerRef.current);
    autoHideRef.current = blinkTimerRef.current = null;
    setNote(null);
  }

  if (!note) return null;

  const style = BLINK[blinkIdx];

  return (
    <div
      style={{
        position:   "fixed",
        bottom:     80,   // above the bottom nav bar
        left:       "50%",
        transform:  "translateX(-50%)",
        width:      "min(92vw, 440px)",
        zIndex:     99999,
        background: style.bg,
        boxShadow:  style.shadow,
        borderRadius: 14,
        padding:    "14px 16px",
        display:    "flex",
        alignItems: "flex-start",
        gap:        12,
        transition: "background 0.55s ease, box-shadow 0.55s ease",
        animation:  "receipt-toast-in 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <style>{`
        @keyframes receipt-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.92); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1); }
        }
      `}</style>

      {/* Icon */}
      <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 9, padding: "8px", flexShrink: 0, marginTop: 1 }}>
        <Receipt size={20} color="white" />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "white", lineHeight: 1.2 }}>
          {note.title}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.88)", marginTop: 3, lineHeight: 1.45, wordBreak: "break-word" }}>
          {note.body}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
        <button
          onClick={() => { dismiss(); router.push(note.url ?? "/suppliers"); }}
          style={{
            background: "rgba(255,255,255,0.25)", border: "none",
            borderRadius: 8, padding: "7px 13px",
            fontSize: 12, fontWeight: 700, color: "white", cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ดู · View
        </button>
        <button
          onClick={dismiss}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.32)",
            borderRadius: 8, padding: "5px 10px",
            fontSize: 11, color: "rgba(255,255,255,0.72)", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          <X size={11} /> ปิด · Close
        </button>
      </div>
    </div>
  );
}
