"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Driver Manager screen — technical_admin only.
// Two flows: Cash receipt and Payment request.

import { useState, useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Camera, QrCode, ChevronLeft, Check, MapPin, RefreshCw, Building2 } from "lucide-react";

type Site = { id: string; name_th: string; name_en: string; status: string };
type Supplier = { id: string; name_th: string; name_en: string; category: string | null; ocr_fingerprints?: string[] | null };

interface Props {
  userId: string;
  ownerId: string;
  driverName: string;
  sites: Site[];
  suppliers: Supplier[];
}

type Flow = "home" | "cash_camera" | "cash_preview" | "cash_site" | "qr_receipt_camera" | "qr_receipt_preview" | "qr_qr_camera" | "qr_qr_preview" | "qr_site" | "success";
type ReceiptType = "cash" | "payment_request";

interface CapturedPhoto {
  blob: Blob;
  dataUrl: string;
  lat: number | null;
  lng: number | null;
  storagePath?: string;
  uploadedUrl?: string;
}

export function DriverClient({ userId, ownerId, driverName, sites, suppliers }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>("home");
  const [receiptType, setReceiptType] = useState<ReceiptType>("cash");
  const [receiptPhoto, setReceiptPhoto] = useState<CapturedPhoto | null>(null);
  const [qrPhoto, setQrPhoto] = useState<CapturedPhoto | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState(sites[0]?.id ?? "");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState<{ suggestedSupplierName: string | null; amount: number | null; confidence: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const geoCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const geoLoadingRef = useRef(false);
  const cashFileRef = useRef<HTMLInputElement>(null);
  const qrReceiptFileRef = useRef<HTMLInputElement>(null);
  const qrCodeFileRef = useRef<HTMLInputElement>(null);

  function isMobile() {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function startGeo() {
    geoCoordsRef.current = null;
    geoLoadingRef.current = true;
    navigator.geolocation?.getCurrentPosition(
      (pos) => { geoCoordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; geoLoadingRef.current = false; },
      () => { geoLoadingRef.current = false; },
      { timeout: 8000 },
    );
  }

  async function fileToPhoto(file: File): Promise<CapturedPhoto> {
    const dataUrl = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = (e) => res(e.target!.result as string);
      r.readAsDataURL(file);
    });
    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      );
      lat = pos.coords.latitude; lng = pos.coords.longitude;
    } catch {}
    return { blob: file, dataUrl, lat, lng };
  }

  async function handleMobileCashFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const photo = await fileToPhoto(file);
    const result = await uploadPhoto(photo, "receipts/cash");
    photo.storagePath = result?.path ?? undefined;
    photo.uploadedUrl = result?.signedUrl ?? undefined;
    setReceiptPhoto(photo); setFlow("cash_preview");
    if (result) runOCR(photo);
  }

  async function handleMobileQrReceiptFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const photo = await fileToPhoto(file);
    const result = await uploadPhoto(photo, "receipts/qr");
    photo.storagePath = result?.path ?? undefined;
    photo.uploadedUrl = result?.signedUrl ?? undefined;
    setReceiptPhoto(photo); setFlow("qr_receipt_preview");
    if (result) runOCR(photo);
  }

  async function handleMobileQrCodeFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const photo = await fileToPhoto(file);
    const result = await uploadPhoto(photo, "receipts/qr_code");
    photo.storagePath = result?.path ?? undefined;
    photo.uploadedUrl = result?.signedUrl ?? undefined;
    setQrPhoto(photo); setFlow("qr_qr_preview");
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  // ── Camera helpers ──────────────────────────────────────────────────────────

  async function startCamera() {
    startGeo();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
    } catch {
      showToast("ไม่สามารถเปิดกล้อง · Camera denied");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function captureFrame(): Promise<CapturedPhoto | null> {
    if (!videoRef.current) return null;
    const v = videoRef.current;
    await new Promise<void>((res) => {
      if (v.readyState >= 2) { res(); return; }
      const h = () => { v.removeEventListener("canplay", h); res(); };
      v.addEventListener("canplay", h);
      setTimeout(res, 2000);
    });
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob>((r) => canvas.toBlob(r as any, "image/jpeg", 0.85));
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const coords = geoCoordsRef.current;
    stopCamera();
    return { blob, dataUrl, lat: coords?.lat ?? null, lng: coords?.lng ?? null };
  }

  async function uploadPhoto(photo: CapturedPhoto, folder: string): Promise<{ path: string; signedUrl: string } | null> {
    const fileName = `${folder}/${ownerId}/${Date.now()}.jpg`;
    const { data, error } = await supabase.storage.from("receipt-photos").upload(fileName, photo.blob, { contentType: "image/jpeg" });
    if (error || !data) return null;
    const { data: signed } = await supabase.storage.from("receipt-photos").createSignedUrl(fileName, 900);
    return signed ? { path: fileName, signedUrl: signed.signedUrl } : null;
  }

  // ── OCR after receipt photo captured ──────────────────────────────────────

  async function runOCR(photo: CapturedPhoto) {
    if (!photo.uploadedUrl) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/receipts/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: photo.uploadedUrl, knownSuppliers: suppliers }),
      });
      if (res.ok) {
        const data = await res.json();
        setOcrResult({ suggestedSupplierName: data.suggestedSupplierName, amount: data.amount, confidence: data.confidence });
      }
    } catch {}
    setAnalyzing(false);
  }

  // ── Cash receipt flow ──────────────────────────────────────────────────────

  async function handleCashCameraCapture() {
    const photo = await captureFrame();
    if (!photo) return;
    // Upload immediately for OCR
    const result = await uploadPhoto(photo, "receipts/cash");
    photo.storagePath = result?.path ?? undefined;
    photo.uploadedUrl = result?.signedUrl ?? undefined;
    setReceiptPhoto(photo);
    setFlow("cash_preview");
    if (result) runOCR(photo);
  }

  async function handleCashSend() {
    if (!receiptPhoto || !selectedSiteId) return;
    setSending(true);
    try {
      let photoPath = receiptPhoto.storagePath;
      if (!photoPath) {
        const result = await uploadPhoto(receiptPhoto, "receipts/cash");
        photoPath = result?.path ?? undefined;
      }
      const site = sites.find((s) => s.id === selectedSiteId);
      const res = await fetch("/api/receipts/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_url: photoPath ?? null,
          photo_lat: receiptPhoto.lat ?? null,
          photo_lng: receiptPhoto.lng ?? null,
          site_id: selectedSiteId,
          amount: ocrResult?.amount ?? null,
          description: ocrResult?.suggestedSupplierName ?? null,
          ocr_supplier_hint: ocrResult?.suggestedSupplierName ?? null,
          site_name_th: site?.name_th ?? "",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(`Error ${res.status}: ${body?.error ?? "unknown"}`);
        return;
      }
      setReceiptPhoto(null);
      setOcrResult(null);
      setFlow("success");
      setTimeout(() => setFlow("home"), 2500);
    } catch (err) {
      showToast(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }

  // ── Payment request flow ───────────────────────────────────────────────────

  async function handleQRReceiptCapture() {
    const photo = await captureFrame();
    if (!photo) return;
    const result = await uploadPhoto(photo, "receipts/qr");
    photo.storagePath = result?.path ?? undefined;
    photo.uploadedUrl = result?.signedUrl ?? undefined;
    setReceiptPhoto(photo);
    setFlow("qr_receipt_preview");
    if (result) runOCR(photo);
  }

  async function handleQRQRCapture() {
    const photo = await captureFrame();
    if (!photo) return;
    const result = await uploadPhoto(photo, "receipts/qr_code");
    photo.storagePath = result?.path ?? undefined;
    photo.uploadedUrl = result?.signedUrl ?? undefined;
    setQrPhoto(photo);
    setFlow("qr_qr_preview");
  }

  async function handlePaymentRequestSend() {
    if (!receiptPhoto || !qrPhoto || !selectedSiteId) return;
    setSending(true);
    let receiptPath = receiptPhoto.storagePath;
    if (!receiptPath) {
      const result = await uploadPhoto(receiptPhoto, "receipts/qr");
      receiptPath = result?.path ?? undefined;
    }
    let qrPath = qrPhoto.storagePath;
    if (!qrPath) {
      const result = await uploadPhoto(qrPhoto, "receipts/qr_code");
      qrPath = result?.path ?? undefined;
    }
    const { error } = await supabase.from("receipts").insert({
      owner_id: ownerId,
      submitted_by: userId,
      site_id: selectedSiteId,
      photo_url: receiptPath ?? null,
      qr_photo_url: qrPath ?? null,
      photo_lat: receiptPhoto.lat,
      photo_lng: receiptPhoto.lng,
      payment_method: "qr",
      status: "pending_qr",
      amount: ocrResult?.amount ?? null,
      description: ocrResult?.suggestedSupplierName ?? null,
      ocr_supplier_hint: ocrResult?.suggestedSupplierName ?? null,
    });
    setSending(false);
    if (error) { showToast("เกิดข้อผิดพลาด · Error"); return; }

    // Push notification to owner
    const site = sites.find((s) => s.id === selectedSiteId);
    const amount = ocrResult?.amount ? `฿${ocrResult.amount.toLocaleString()}` : "";
    fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_id: ownerId,
        title: "💳 คำขอชำระเงิน · Payment request",
        body: `${driverName} · ${site?.name_th ?? ""} ${amount}`.trim(),
        url: "/suppliers",
      }),
    }).catch(() => {});

    setReceiptPhoto(null);
    setQrPhoto(null);
    setOcrResult(null);
    setFlow("success");
    setTimeout(() => setFlow("home"), 2500);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  // Success
  if (flow === "success") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#F0FDF4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Check size={40} color="white" />
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#15803D" }}>ส่งแล้ว · Sent</div>
        <div style={{ fontSize: 14, color: "#6B7280" }}>เจ้าของจะตรวจสอบ · Owner will review</div>
      </div>
    );
  }

  // Camera screen (shared)
  const isCameraFlow = flow === "cash_camera" || flow === "qr_receipt_camera" || flow === "qr_qr_camera";
  if (isCameraFlow) {
    const isQrCode = flow === "qr_qr_camera";
    const label = isQrCode ? "ถ่าย QR / QR code" : "ถ่ายรูปใบเสร็จ / Receipt photo";
    const hint = isQrCode ? "ถ่าย QR ให้ชัด · Capture QR clearly" : "ถ่ายใบเสร็จ / order ทั้งหมด · Full receipt/order";
    const onCapture = flow === "cash_camera" ? handleCashCameraCapture
      : flow === "qr_receipt_camera" ? handleQRReceiptCapture
      : handleQRQRCapture;
    const onBack = () => {
      stopCamera();
      if (flow === "cash_camera") setFlow("home");
      else if (flow === "qr_receipt_camera") setFlow("home");
      else setFlow("qr_receipt_preview");
    };

    return (
      <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", flexDirection: "column" }}
        ref={(el) => { if (el && streamRef.current === null) startCamera(); }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "16px", background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "white", cursor: "pointer", marginBottom: 8 }}>
            <ChevronLeft size={28} />
          </button>
          <div style={{ color: "white", fontSize: 17, fontWeight: 700 }}>{label}</div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{hint}</div>
        </div>
        <video ref={videoRef} autoPlay playsInline muted style={{ flex: 1, objectFit: "cover", width: "100%" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px 32px 48px", background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)", display: "flex", justifyContent: "center" }}>
          <button
            onClick={onCapture}
            style={{ width: 72, height: 72, borderRadius: "50%", border: "4px solid white", background: "white", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#1E3A8A" }} />
          </button>
        </div>
      </div>
    );
  }

  // Preview screen (shared)
  const isPreviewFlow = flow === "cash_preview" || flow === "qr_receipt_preview" || flow === "qr_qr_preview";
  if (isPreviewFlow) {
    const photo = flow === "qr_qr_preview" ? qrPhoto : receiptPhoto;
    const isQrStep = flow === "qr_qr_preview";
    const onConfirm = () => {
      if (flow === "cash_preview") setFlow("cash_site");
      else if (flow === "qr_receipt_preview") {
        if (isMobile()) { qrCodeFileRef.current?.click(); }
        else { setFlow("qr_qr_camera"); startCamera(); }
      }
      else setFlow("qr_site");
    };
    const onRetake = () => {
      if (flow === "cash_preview") {
        setReceiptPhoto(null);
        if (isMobile()) cashFileRef.current?.click();
        else { setFlow("cash_camera"); startCamera(); }
      } else if (flow === "qr_receipt_preview") {
        setReceiptPhoto(null);
        if (isMobile()) qrReceiptFileRef.current?.click();
        else { setFlow("qr_receipt_camera"); startCamera(); }
      } else {
        setQrPhoto(null);
        if (isMobile()) qrCodeFileRef.current?.click();
        else { setFlow("qr_qr_camera"); startCamera(); }
      }
    };

    return (
      <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "16px", background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}>
          <div style={{ color: "white", fontSize: 16, fontWeight: 700 }}>
            {isQrStep ? "ตรวจสอบ QR · Check QR" : "ตรวจสอบใบเสร็จ · Check receipt"}
          </div>
          {!isQrStep && analyzing && (
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> กำลังวิเคราะห์ · Analyzing…
            </div>
          )}
          {!isQrStep && ocrResult && ocrResult.confidence !== "none" && !analyzing && (
            <div style={{ marginTop: 8, background: "rgba(34,197,94,0.2)", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "#4ADE80" }}>
              🔍 {ocrResult.suggestedSupplierName ?? "ไม่พบชื่อร้าน"}{ocrResult.amount ? ` · ฿${ocrResult.amount.toLocaleString()}` : ""}
            </div>
          )}
        </div>

        {photo?.dataUrl && (
          <img src={photo.dataUrl} alt="preview" style={{ flex: 1, objectFit: "cover", width: "100%" }} />
        )}

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 24px 48px", background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)", display: "flex", gap: 16 }}>
          <button onClick={onRetake} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "2px solid white", background: "transparent", color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            ถ่ายใหม่ · Retake
          </button>
          <button onClick={onConfirm} style={{ flex: 2, padding: "14px", borderRadius: 12, border: "none", background: isQrStep ? "#8B5CF6" : "#22C55E", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Check size={18} />
            {isQrStep ? "ถัดไป · Next" : flow === "qr_receipt_preview" ? "ถ่าย QR · Scan QR" : "ยืนยัน · Confirm"}
          </button>
        </div>
      </div>
    );
  }

  // Site picker
  if (flow === "cash_site" || flow === "qr_site") {
    const isCash = flow === "cash_site";
    return (
      <div style={{ position: "fixed", inset: 0, background: "white", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "var(--brand-primary)", color: "white", padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setFlow(isCash ? "cash_preview" : "qr_qr_preview")} style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}>
            <ChevronLeft size={24} />
          </button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>เลือกไซต์ · Select site</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{isCash ? "Cash receipt" : "Payment request"}</div>
          </div>
        </div>

        {/* OCR suggestion banner */}
        {ocrResult && (ocrResult.suggestedSupplierName || ocrResult.amount) && ocrResult.confidence !== "none" && (
          <div style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🔍</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#15803D" }}>
                {ocrResult.suggestedSupplierName && `ร้าน: ${ocrResult.suggestedSupplierName}`}
                {ocrResult.amount && ` · ฿${ocrResult.amount.toLocaleString()}`}
              </div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>ข้อมูลจากใบเสร็จ · Auto-detected from receipt</div>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {sites.map((site) => (
            <button
              key={site.id}
              onClick={() => setSelectedSiteId(site.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 14,
                padding: "16px", border: "none", cursor: "pointer",
                borderBottom: "1px solid var(--border)", textAlign: "left",
                background: selectedSiteId === site.id ? "#EFF6FF" : "transparent",
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: selectedSiteId === site.id ? "var(--brand-primary)" : "#E5E7EB",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <MapPin size={18} color={selectedSiteId === site.id ? "white" : "#9CA3AF"} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: selectedSiteId === site.id ? "var(--brand-primary)" : "var(--text-primary)" }}>
                  {site.name_th}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{site.name_en}</div>
              </div>
              {selectedSiteId === site.id && <Check size={20} color="var(--brand-primary)" />}
            </button>
          ))}
        </div>

        <div style={{ padding: "12px 16px 32px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={isCash ? handleCashSend : handlePaymentRequestSend}
            disabled={sending || !selectedSiteId}
            style={{
              width: "100%", padding: "16px", borderRadius: 12, border: "none",
              background: selectedSiteId ? (isCash ? "#1E3A8A" : "#7C3AED") : "#E5E7EB",
              color: selectedSiteId ? "white" : "#9CA3AF",
              fontSize: 16, fontWeight: 700, cursor: selectedSiteId ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}
          >
            {isCash ? <Camera size={20} /> : <QrCode size={20} />}
            {sending ? "กำลังส่ง…" : isCash ? "ส่งใบเสร็จ · Send receipt" : "ส่งคำขอชำระ · Send payment request"}
          </button>
        </div>
      </div>
    );
  }

  // Home screen
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "linear-gradient(160deg, #1E3A8A 0%, #1E40AF 40%, #0C4A6E 100%)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ padding: "48px 24px 32px", color: "white" }}>
        <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 6, fontWeight: 500 }}>ระบบนหน้าที่ · Driver panel</div>
        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{driverName}</div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>Field Manager + Driver · เลือกประเภทใบเสร็จ</div>
      </div>

      {/* Two big buttons */}
      <div style={{ flex: 1, padding: "0 24px", display: "flex", flexDirection: "column", gap: 16, justifyContent: "center" }}>
        {/* Cash receipt */}
        <button
          onClick={() => {
            setReceiptType("cash");
            if (isMobile()) { cashFileRef.current?.click(); }
            else { setFlow("cash_camera"); startCamera(); }
          }}
          style={{
            background: "white", borderRadius: 18, padding: "28px 24px",
            border: "none", cursor: "pointer", textAlign: "left",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "#1E3A8A", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Camera size={28} color="white" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1E3A8A", marginBottom: 6 }}>ใบเสร็จเงินสด</div>
          <div style={{ fontSize: 14, color: "#6B7280" }}>Cash receipt · ถ่ายรูปใบเสร็จที่ชำระแล้ว</div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>Photo → Select site → Send</div>
        </button>

        {/* Payment request */}
        <button
          onClick={() => {
            setReceiptType("payment_request");
            if (isMobile()) { qrReceiptFileRef.current?.click(); }
            else { setFlow("qr_receipt_camera"); startCamera(); }
          }}
          style={{
            background: "linear-gradient(135deg, #7C3AED, #6D28D9)", borderRadius: 18, padding: "28px 24px",
            border: "none", cursor: "pointer", textAlign: "left",
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <QrCode size={28} color="white" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "white", marginBottom: 6 }}>ขอชำระเงิน</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>Payment request · ส่ง QR ให้เจ้าของ</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>Receipt → QR code → Select site → Send</div>
        </button>

        {/* Orange button → field manager sites view */}
        <button
          onClick={() => router.push("/sites")}
          style={{
            background: "linear-gradient(135deg, #F97316, #EA580C)", borderRadius: 18, padding: "20px 24px",
            border: "none", cursor: "pointer", textAlign: "left",
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            display: "flex", alignItems: "center", gap: 16,
          }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Building2 size={26} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "white", marginBottom: 2 }}>ไซต์งาน · Sites</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>รายงานการเข้างาน · Attendance report</div>
          </div>
        </button>
      </div>

      <div style={{ padding: "16px 24px 48px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Workforce · Driver Panel · 24/7</div>
      </div>

      {/* Hidden file inputs for mobile camera (still photo, no video) */}
      <input ref={cashFileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleMobileCashFile} />
      <input ref={qrReceiptFileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleMobileQrReceiptFile} />
      <input ref={qrCodeFileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleMobileQrCodeFile} />

      {toast && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#EF4444", color: "white", padding: "10px 20px", borderRadius: 10, fontSize: 14, zIndex: 2000 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
