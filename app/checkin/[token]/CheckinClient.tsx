"use client";

import { useState, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Site { id: string; name_th: string; name_en: string; location_th?: string; location_en?: string }
interface Worker { id: string; name_th: string; name_en: string }

type Step = "phone" | "sites" | "camera" | "success" | "error" | "used" | "expired";

// ─── Main component ───────────────────────────────────────────────────────────
export function CheckinClient({ token }: { token: string }) {
  const [step,     setStep]     = useState<Step>("phone");
  const [digits,   setDigits]   = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [worker,   setWorker]   = useState<Worker | null>(null);
  const [sites,    setSites]    = useState<Site[]>([]);
  const [site,     setSite]     = useState<Site | null>(null);
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  const [gps,      setGps]      = useState<{ lat: number; lng: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Step 1: verify phone ────────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    if (digits.length !== 4) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, last4: digits }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "already_used") { setStep("used"); return; }
        if (json.error === "expired")      { setStep("expired"); return; }
        if (json.error === "not_found")    { setStep("error"); return; }
        if (json.error === "wrong_phone")  {
          setError("Wrong number / หมายเลขไม่ถูกต้อง");
          setDigits("");
          return;
        }
        setError(json.error ?? "Error");
        return;
      }
      setWorker(json.worker);
      setSites(json.sites ?? []);
      setStep("sites");
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }, [digits, token]);

  // ── Step 3: capture photo ───────────────────────────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoB64(reader.result as string);
      // Get GPS
      navigator.geolocation?.getCurrentPosition(
        (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setGps(null),
        { timeout: 8000, maximumAge: 0 }
      );
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Step 3→4: submit ────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!site || !photoB64) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkin/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          site_id: site.id,
          photo_data: photoB64,
          lat: gps?.lat ?? null,
          lng: gps?.lng ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "already_used") { setStep("used"); return; }
        setError(json.error ?? "Submit failed");
        return;
      }
      setStep("success");
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }, [site, photoB64, gps, token]);

  // ── Digit input helper ──────────────────────────────────────────────────────
  const handleDigit = (d: string) => {
    if (digits.length < 4) {
      const next = digits + d;
      setDigits(next);
      if (next.length === 4) {
        // auto-submit after short delay so user sees 4th digit
        setTimeout(() => {
          setDigits(next); // ensure state is latest
        }, 50);
      }
    }
  };
  const handleBack = () => setDigits((prev) => prev.slice(0, -1));

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  // Terminal states
  if (step === "used") return <Terminal icon="✓" title="Already checked in today" subtitle="เช็คอินแล้ววันนี้" color="#22C55E" />;
  if (step === "expired") return <Terminal icon="⏱" title="Link has expired" subtitle="ลิงก์หมดอายุแล้ว — ask your manager" color="#F97316" />;
  if (step === "error") return <Terminal icon="✗" title="Invalid link" subtitle="ลิงก์ไม่ถูกต้อง — ask your manager" color="#EF4444" />;

  // Success
  if (step === "success") return (
    <Shell>
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6">
        <div className="w-28 h-28 rounded-full bg-green-500 flex items-center justify-center animate-bounce-once">
          <span className="text-white text-6xl">✓</span>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">Checked in successfully!</p>
          <p className="text-lg text-gray-500 mt-1">เช็คอินสำเร็จ!</p>
          {site && <p className="text-base text-gray-600 mt-3">{site.name_en} / {site.name_th}</p>}
        </div>
        <p className="text-sm text-gray-400 text-center mt-4">You may close this page.<br/>ปิดหน้านี้ได้เลย</p>
      </div>
    </Shell>
  );

  // Camera step
  if (step === "camera") return (
    <Shell>
      <div className="flex flex-col min-h-screen px-5 py-8 gap-6">
        <button onClick={() => { setSite(null); setPhotoB64(null); setStep("sites"); }}
          className="self-start text-sm text-blue-600">← Back / กลับ</button>

        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">Take your photo</p>
          <p className="text-sm text-gray-500">ถ่ายรูปของคุณ</p>
          {site && <p className="text-sm text-[#1E3A8A] font-medium mt-1">{site.name_en} / {site.name_th}</p>}
        </div>

        {/* Photo preview */}
        {photoB64 ? (
          <div className="flex flex-col gap-4">
            <img src={photoB64} alt="preview" className="w-full rounded-2xl object-cover max-h-72" />
            <button onClick={() => { setPhotoB64(null); fileRef.current?.click(); }}
              className="w-full py-3 rounded-xl border border-gray-300 text-gray-700 font-medium text-base">
              Retake / ถ่ายใหม่
            </button>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button onClick={handleSubmit} disabled={loading}
              className="w-full py-4 rounded-2xl bg-[#1E3A8A] text-white font-bold text-lg disabled:opacity-50">
              {loading ? "Sending…" : "Send ✓ / ส่ง ✓"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 mt-4">
            <div className="w-48 h-48 rounded-full bg-gray-100 border-4 border-dashed border-gray-300 flex items-center justify-center">
              <span className="text-5xl">📷</span>
            </div>
            <button onClick={() => fileRef.current?.click()}
              className="w-full py-4 rounded-2xl bg-[#1E3A8A] text-white font-bold text-xl">
              Open Camera / เปิดกล้อง
            </button>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          className="hidden" onChange={handleFileChange} />
      </div>
    </Shell>
  );

  // Sites step
  if (step === "sites") return (
    <Shell>
      <div className="flex flex-col min-h-screen px-5 py-8 gap-5">
        <div>
          <p className="text-xl font-bold text-gray-900">Choose your site</p>
          <p className="text-sm text-gray-500">เลือกไซต์งานของคุณ</p>
          {worker && <p className="text-sm text-[#1E3A8A] font-medium mt-1">{worker.name_en} / {worker.name_th}</p>}
        </div>
        <div className="flex flex-col gap-3">
          {sites.map((s) => (
            <button key={s.id} onClick={() => { setSite(s); setStep("camera"); }}
              className="w-full text-left px-5 py-4 rounded-2xl bg-white border border-gray-200 shadow-sm active:bg-blue-50">
              <p className="font-semibold text-gray-900 text-base">{s.name_en}</p>
              <p className="text-sm text-gray-500">{s.name_th}</p>
              {s.location_en && <p className="text-xs text-gray-400 mt-0.5">{s.location_en}</p>}
            </button>
          ))}
        </div>
      </div>
    </Shell>
  );

  // Phone step (default)
  return (
    <Shell>
      <div className="flex flex-col min-h-screen px-6 py-10 gap-8">
        {/* Header */}
        <div className="text-center mt-6">
          <div className="text-4xl mb-3">👷</div>
          <p className="text-2xl font-bold text-gray-900">Workforce Check-in</p>
          <p className="text-base text-gray-500 mt-1">เช็คอินเข้างาน</p>
        </div>

        {/* Instruction */}
        <div className="text-center">
          <p className="text-base font-medium text-gray-800">Enter last 4 digits of your phone</p>
          <p className="text-sm text-gray-500 mt-1">กรอก 4 หลักสุดท้ายของโทรศัพท์คุณ</p>
        </div>

        {/* Digit display */}
        <div className="flex justify-center gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}
              className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold
                ${digits[i] ? "border-[#1E3A8A] text-[#1E3A8A]" : "border-gray-300 text-gray-300"}`}>
              {digits[i] ? "●" : "○"}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && <p className="text-center text-red-500 text-sm -mt-4">{error}</p>}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto w-full">
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
            <button key={i}
              onClick={() => d === "⌫" ? handleBack() : d !== "" ? handleDigit(d) : null}
              disabled={d === ""}
              className={`h-16 rounded-2xl text-2xl font-semibold transition-all
                ${d === "" ? "invisible" : "bg-gray-100 active:bg-gray-200 text-gray-800"}`}>
              {d}
            </button>
          ))}
        </div>

        {/* Confirm button */}
        <button onClick={handleVerify}
          disabled={digits.length !== 4 || loading}
          className="w-full py-4 rounded-2xl bg-[#1E3A8A] text-white font-bold text-lg
            disabled:opacity-40 transition-opacity">
          {loading ? "Checking…" : "Continue / ต่อไป →"}
        </button>
      </div>
    </Shell>
  );
}

// ─── Shell: no nav, no sidebar ────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F6FA] font-sans max-w-md mx-auto">
      {children}
    </div>
  );
}

// ─── Terminal screens (used/expired/error) ────────────────────────────────────
function Terminal({ icon, title, subtitle, color }: { icon: string; title: string; subtitle: string; color: string }) {
  return (
    <Shell>
      <div className="flex flex-col items-center justify-center min-h-screen gap-5 px-6">
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
          style={{ backgroundColor: color + "20", color }}>
          {icon}
        </div>
        <p className="text-xl font-bold text-gray-900 text-center">{title}</p>
        <p className="text-sm text-gray-500 text-center">{subtitle}</p>
      </div>
    </Shell>
  );
}
