"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, QrCode, Check } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { parseThaiQR } from "@/lib/qr-parser";

type Phase = "scanning" | "confirm" | "submitting" | "done";

interface ScannedQR {
  raw: string;
  merchantName: string | null;
  amount: number | null;
  accountId: string | null;
}

interface ScanClientProps {
  ownerId: string;
  userId: string;
  sites: { id: string; name_th: string; name_en: string }[];
  defaultSiteId?: string;
}

export function ScanClient({ ownerId, userId, sites, defaultSiteId }: ScanClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const scanningRef = useRef(false);
  const jsQRRef = useRef<typeof import("jsqr")["default"] | null>(null);

  const [phase, setPhase] = useState<Phase>("scanning");
  const [scanned, setScanned] = useState<ScannedQR | null>(null);
  const [merchantInput, setMerchantInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [siteId, setSiteId] = useState(defaultSiteId ?? sites[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [cameraError, setCameraError] = useState("");

  // Load jsQR once
  useEffect(() => {
    import("jsqr").then((m) => { jsQRRef.current = m.default; });
  }, []);

  // Start camera on mount, stop on unmount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (active) setCameraError("ไม่สามารถเข้าถึงกล้องได้ · Camera access denied");
      }
    })();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // QR scan loop
  useEffect(() => {
    if (phase !== "scanning") {
      scanningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      return;
    }
    scanningRef.current = true;

    function tick() {
      if (!scanningRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const jsQR = jsQRRef.current;
      if (video && canvas && jsQR && video.readyState >= 2 && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && scanningRef.current) {
            scanningRef.current = false;
            const parsed = parseThaiQR(code.data);
            setScanned({ raw: code.data, ...parsed });
            setMerchantInput(parsed.merchantName ?? "");
            setAmountInput(parsed.amount != null ? String(parsed.amount) : "");
            setPhase("confirm");
            return;
          }
        }
      }
      if (scanningRef.current) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      scanningRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase]);

  function resetScan() {
    setScanned(null);
    setMerchantInput("");
    setAmountInput("");
    setNotes("");
    setError("");
    setPhase("scanning");
  }

  async function handleSubmit() {
    const amt = parseFloat(amountInput);
    if (!amt || amt <= 0) { setError("กรอกยอดที่ถูกต้อง · Enter a valid amount"); return; }
    setError("");
    setPhase("submitting");

    const { data: inserted, error: dbErr } = await supabase.from("receipts").insert({
      owner_id: ownerId,
      submitted_by: userId,
      scanned_by: userId,
      scanned_at: new Date().toISOString(),
      site_id: siteId || null,
      amount: amt,
      description: merchantInput || scanned?.accountId || null,
      notes: notes || null,
      qr_value: scanned?.raw ?? null,
      status: "pending_qr",
      receipt_number: `QR-${Date.now()}`,
    }).select("id").single();

    if (dbErr) {
      setError(dbErr.message);
      setPhase("confirm");
      return;
    }

    try {
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_id: ownerId,
          title: `QR รอชำระ ฿${formatCurrency(amt)}`,
          body: merchantInput || "คนขับส่ง QR รอการชำระเงิน",
          url: "/suppliers",
        }),
      });
    } catch {}

    // Schedule 1.5-hour follow-up push if still unpaid
    if (inserted?.id) {
      setTimeout(() => {
        fetch("/api/cron/qr-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receipt_id: inserted.id, owner_id: ownerId }),
        }).catch(() => {});
      }, 90 * 60 * 1000);
    }

    setPhase("done");
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 200, background: "var(--bg-page)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 20, padding: 32,
      }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Check size={40} color="#15803D" strokeWidth={2.5} />
        </div>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>ส่งให้เจ้าของแล้ว</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Sent to owner · Waiting for payment</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 300 }}>
          <button onClick={resetScan} className="btn-primary" style={{ justifyContent: "center" }}>
            <QrCode size={18} /> สแกนอีกครั้ง · Scan again
          </button>
          <button
            onClick={() => router.back()}
            style={{ padding: "11px", border: "1px solid var(--border)", borderRadius: 10, background: "white", cursor: "pointer", fontSize: 14 }}
          >
            กลับ · Back
          </button>
        </div>
      </div>
    );
  }

  // ── QR finder corners ────────────────────────────────────────────────────────
  const corners = (
    <>
      {([
        { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderRadius: "4px 0 0 0" },
        { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderRadius: "0 4px 0 0" },
        { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderRadius: "0 0 0 4px" },
        { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderRadius: "0 0 4px 0" },
      ] as React.CSSProperties[]).map((style, i) => (
        <div key={i} style={{ position: "absolute", width: 28, height: 28, borderColor: "white", borderStyle: "solid", ...style }} />
      ))}
    </>
  );

  // ── Confirm form ─────────────────────────────────────────────────────────────
  const confirmForm = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "20px 20px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <QrCode size={20} color="var(--brand-primary)" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>พบ QR Code</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>ตรวจสอบและส่งให้เจ้าของ · Review and send to owner</p>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 14 }}>
          {error}
        </div>
      )}

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>ผู้รับเงิน · Payee / Merchant</span>
        <input
          value={merchantInput}
          onChange={(e) => setMerchantInput(e.target.value)}
          placeholder="ชื่อร้านค้า / Merchant name"
          style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>ยอดเงิน Amount ฿ *</span>
        <input
          type="number"
          inputMode="decimal"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder="0.00"
          style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
        />
      </label>

      {sites.length > 0 && (
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>ไซต์ · Site</span>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
          >
            <option value="">ไม่ระบุ · None</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name_th}</option>)}
          </select>
        </label>
      )}

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>หมายเหตุ · Notes</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="รายละเอียดสินค้า / Item details"
          style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
        />
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={resetScan}
          style={{ flex: 1, padding: "11px", border: "1px solid var(--border)", borderRadius: 10, background: "white", cursor: "pointer", fontSize: 14 }}
        >
          สแกนใหม่
        </button>
        <button
          onClick={handleSubmit}
          disabled={phase === "submitting"}
          className="btn-primary"
          style={{ flex: 2, justifyContent: "center" }}
        >
          {phase === "submitting" ? "กำลังส่ง…" : "ส่งให้เจ้าของ · Send"}
        </button>
      </div>
    </div>
  );

  // ── Main render: fullscreen overlay ─────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "env(safe-area-inset-top, 16px) 16px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => router.back()}
          style={{ background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%", width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <ArrowLeft size={20} color="white" />
        </button>
        <span style={{ color: "white", fontSize: 16, fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
          สแกน QR · Scan QR Payment
        </span>
      </div>

      {/* Camera */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {cameraError ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white", gap: 14, padding: 32 }}>
            <QrCode size={56} opacity={0.4} />
            <p style={{ textAlign: "center", fontSize: 15, opacity: 0.8 }}>{cameraError}</p>
            <button
              onClick={() => router.back()}
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 14 }}
            >
              กลับ · Back
            </button>
          </div>
        ) : (
          <>
            <video
              ref={(el) => { videoRef.current = el; if (el && streamRef.current) el.srcObject = streamRef.current; }}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            {phase === "scanning" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
                {/* Dim overlay outside finder */}
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
                {/* Finder box */}
                <div style={{ position: "relative", zIndex: 1, width: 220, height: 220 }}>
                  {corners}
                  {/* Clear center */}
                  <div style={{ position: "absolute", inset: 0, background: "transparent" }} />
                </div>
                <p style={{ position: "relative", zIndex: 1, color: "white", fontSize: 14, textAlign: "center", textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                  เล็งกล้องไปที่ QR Code<br />
                  <small style={{ opacity: 0.75 }}>Point camera at QR code</small>
                </p>
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      {/* Confirm form — slides up from bottom when QR found */}
      {(phase === "confirm" || phase === "submitting") && (
        <div style={{ background: "white", borderRadius: "20px 20px 0 0", maxHeight: "65vh", overflowY: "auto" }}>
          {confirmForm}
        </div>
      )}
    </div>
  );
}
