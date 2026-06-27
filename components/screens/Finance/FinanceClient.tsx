"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Check, Banknote, Receipt, Users, Camera, MapPin, Wallet, X } from "lucide-react";
import NextImage from "next/image";
import { formatCurrency, formatThaiDate } from "@/lib/format";

interface DriverCashEntry {
  driver: { id: string; name_th: string; name_en: string };
  totalGiven: number;
  totalSpent: number;
  balance: number;
}

interface FinanceClientProps {
  todayAttendance: any[];
  pendingReceipts: any[];
  pendingAdvances: any[];
  weeklyWages: any[];
  ownerId: string;
  userId?: string;
  today: string;
  driverCashData: DriverCashEntry[];
}

export function FinanceClient({ todayAttendance, pendingReceipts: initReceipts, pendingAdvances: initAdvances, weeklyWages, ownerId, userId, today, driverCashData }: FinanceClientProps) {
  const supabase = createClient();
  const [pendingReceipts, setPendingReceipts] = useState(initReceipts);
  const [pendingAdvances, setPendingAdvances] = useState(initAdvances);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 5000);
  }

  const todayWageTotal = useMemo(() =>
    todayAttendance.reduce((s, a) => s + (a.wage_amount ?? 0), 0),
    [todayAttendance]
  );
  const pendingReceiptTotal = useMemo(() =>
    pendingReceipts.reduce((s, r) => s + (r.amount ?? 0), 0),
    [pendingReceipts]
  );
  const pendingAdvanceTotal = useMemo(() =>
    pendingAdvances.reduce((s, a) => s + (a.amount ?? 0), 0),
    [pendingAdvances]
  );
  const grandTotal = todayWageTotal + pendingReceiptTotal + pendingAdvanceTotal;

  // Weekly chart data
  const weeklyByDate = useMemo(() => {
    const map = new Map<string, number>();
    weeklyWages.forEach((w) => {
      map.set(w.event_date, (map.get(w.event_date) ?? 0) + (w.wage_amount ?? 0));
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [weeklyWages]);

  const maxWeekly = Math.max(...weeklyByDate.map(([, v]) => v), 1);

  async function handlePayAdvance(id: string) {
    const { error } = await supabase
      .from("advances")
      .update({ status: "paid" })
      .eq("id", id);
    if (!error) {
      setPendingAdvances((prev) => prev.filter((a) => a.id !== id));
      showToast("บันทึกการจ่ายเงินแล้ว · Advance marked as paid");
    }
  }

  async function handlePayReceipt(id: string) {
    const { error } = await supabase
      .from("receipts")
      .update({ status: "paid" })
      .eq("id", id);
    if (!error) {
      setPendingReceipts((prev) => prev.filter((r) => r.id !== id));
      showToast("ชำระใบเสร็จแล้ว · Receipt marked as paid");
    }
  }

  // ── Right panel ─────────────────────────────────────────────────────────────
  const rightPanel = (
    <section className="attention-card">
      <h2>ยอดรวมวันนี้ <span>Grand total today</span></h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        {[
          { th: "ค่าแรง", en: "Wages", val: todayWageTotal },
          { th: "ใบเสร็จค้างจ่าย", en: "Pending receipts", val: pendingReceiptTotal },
          { th: "เบิกค้างจ่าย", en: "Pending advances", val: pendingAdvanceTotal },
        ].map((item) => (
          <div key={item.th} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text-muted)" }}>{item.th} · {item.en}</span>
            <strong>฿{formatCurrency(item.val)}</strong>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, paddingTop: 8 }}>
          <strong>ยอดรวม · Total</strong>
          <strong style={{ color: "var(--brand-primary)", fontSize: 22 }}>฿{formatCurrency(grandTotal)}</strong>
        </div>
      </div>
    </section>
  );

  return (
    <>
      <DashboardShell rightPanel={rightPanel}>
        {/* Desktop */}
        <div className="desktop-only">
          <div className="content-header">
            <div>
              <h1>การเงิน</h1>
              <p>Finance · {formatThaiDate(today)}</p>
            </div>
          </div>

          {/* Summary cards */}
          <div className="metric-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 28 }}>
            <div className="metric-card blue">
              <div className="metric-icon blue"><Users size={28} strokeWidth={1.8} /></div>
              <div className="metric-label">
                <strong>ค่าแรงวันนี้</strong>
                <small>Today wages · {todayAttendance.length} คน</small>
              </div>
              <div className="metric-value" style={{ fontSize: 22 }}>฿{formatCurrency(todayWageTotal)}</div>
            </div>
            <div className="metric-card orange">
              <div className="metric-icon orange"><Receipt size={28} strokeWidth={1.8} /></div>
              <div className="metric-label">
                <strong>ใบเสร็จค้าง</strong>
                <small>Pending receipts · {pendingReceipts.length} รายการ</small>
              </div>
              <div className="metric-value" style={{ fontSize: 22 }}>฿{formatCurrency(pendingReceiptTotal)}</div>
            </div>
            <div className="metric-card amber">
              <div className="metric-icon" style={{ color: "#F59E0B" }}><Banknote size={28} strokeWidth={1.8} /></div>
              <div className="metric-label">
                <strong>เบิกค้าง</strong>
                <small>Pending advances · {pendingAdvances.length} รายการ</small>
              </div>
              <div className="metric-value" style={{ fontSize: 22 }}>฿{formatCurrency(pendingAdvanceTotal)}</div>
            </div>
          </div>

          {/* Weekly bar chart */}
          {weeklyByDate.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>
                ค่าแรง 7 วัน <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>7-day wage totals</span>
              </h2>
              <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 20px 12px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 100 }}>
                  {weeklyByDate.map(([date, total]) => (
                    <div key={date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>฿{formatCurrency(total)}</span>
                      <div
                        style={{
                          width: "100%",
                          background: date === today ? "var(--brand-primary)" : "#BFDBFE",
                          borderRadius: "4px 4px 0 0",
                          height: `${Math.max(8, (total / maxWeekly) * 80)}px`,
                          transition: "height 0.3s",
                        }}
                      />
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {new Date(date).toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Pending receipts */}
          {pendingReceipts.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>
                ใบเสร็จรอชำระ <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Pending receipts</span>
              </h2>
              <div className="table-card">
                {pendingReceipts.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: 15 }}>{r.supplier?.name_th ?? "ไม่ระบุ"}</strong>
                      <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>{r.site?.name_th ?? ""} · {r.description ?? r.category ?? ""}</small>
                    </div>
                    <strong style={{ fontSize: 17 }}>฿{formatCurrency(r.amount)}</strong>
                    <button
                      onClick={() => handlePayReceipt(r.id)}
                      className="btn-primary"
                      style={{ padding: "7px 14px", fontSize: 13 }}
                    >
                      <Check size={16} /> จ่ายแล้ว
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending advances */}
          {pendingAdvances.length > 0 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>
                เบิกเงินรอชำระ <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Pending advances</span>
              </h2>
              <div className="table-card">
                {pendingAdvances.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
                    <div className="avatar" style={{ width: 34, height: 34, fontSize: 11, flexShrink: 0, overflow: "hidden", padding: a.worker?.photo_url ? 0 : undefined }}>
                      {a.worker?.photo_url ? <img src={a.worker.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (a.worker?.name_th?.[0] ?? "?")}
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: 15 }}>{a.worker?.name_th ?? "?"}</strong>
                      <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>{a.reason ?? "เบิกเงิน"} · {formatThaiDate(a.created_at)}</small>
                    </div>
                    <strong style={{ fontSize: 17 }}>฿{formatCurrency(a.amount)}</strong>
                    <button
                      onClick={() => handlePayAdvance(a.id)}
                      className="btn-primary"
                      style={{ padding: "7px 14px", fontSize: 13, background: "#F59E0B" }}
                    >
                      <Check size={16} /> จ่ายแล้ว
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mobile */}
        <div className="mobile-only">
          <MobileFinance
            todayWageTotal={todayWageTotal}
            pendingReceiptTotal={pendingReceiptTotal}
            pendingAdvanceTotal={pendingAdvanceTotal}
            pendingReceipts={pendingReceipts}
            pendingAdvances={pendingAdvances}
            today={today}
            onPayReceipt={handlePayReceipt}
            onPayAdvance={handlePayAdvance}
            driverCashData={driverCashData}
            ownerId={ownerId}
            userId={userId}
          />
        </div>

        {toast && <div className="toast">{toast}</div>}
      </DashboardShell>
    </>
  );
}

// ── Give Cash Modal (mobile Finance) ─────────────────────────────────────────

function GiveCashModalMobile({ driver, ownerId, userId, onClose, onDone }: {
  driver: { id: string; name_th: string; name_en: string };
  ownerId: string;
  userId?: string;
  onClose: () => void;
  onDone: (amount: number) => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  function handleCameraClick() {
    setGpsLoading(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsLoading(false); },
      () => { setGpsLoading(false); },
      { timeout: 6000, maximumAge: 0 }
    );
    setTimeout(() => fileRef.current?.click(), 50);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBlob(file);
    setPhotoUrl(URL.createObjectURL(file));
  }

  async function handleSave() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError("กรอกยอดที่ถูกต้อง · Valid amount required"); return; }
    setSaving(true);

    let storedPhotoUrl: string | null = null;
    if (photoBlob) {
      const fileName = `cash-entries/${ownerId}/${Date.now()}.jpg`;
      const { data: uploadData } = await supabase.storage
        .from("receipt-photos")
        .upload(fileName, photoBlob, { contentType: "image/jpeg" });
      if (uploadData) {
        const { data: urlData } = supabase.storage.from("receipt-photos").getPublicUrl(fileName);
        storedPhotoUrl = urlData?.publicUrl ?? null;
      }
    }

    const { error: dbError } = await supabase
      .from("driver_cash_entries")
      .insert({
        owner_id: ownerId,
        driver_user_id: driver.id,
        amount: amt,
        notes: notes || null,
        given_by: userId ?? null,
        photo_url: storedPhotoUrl,
        gps_lat: gps?.lat ?? null,
        gps_lng: gps?.lng ?? null,
      });

    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    onDone(amt);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.72)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
              <span className="th-text">มอบเงินคนขับ</span>
              <span className="en-text">Give cash to driver</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{driver.name_th}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(0,0,0,0.07)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{error}</div>}

        <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <Wallet size={20} color="var(--brand-primary)" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{driver.name_th}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{driver.name_en} · Driver Manager</div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
            <span className="th-text">ยอดเงิน</span>
            <span className="en-text">Amount</span> ฿ *
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            style={{ width: "100%", fontSize: 16, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", outline: "none" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
            <span className="th-text">หมายเหตุ</span>
            <span className="en-text">Notes</span>
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ค่าวัสดุสำหรับไซต์…"
            style={{ width: "100%", fontSize: 15, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", outline: "none" }}
          />
        </div>

        {photoUrl ? (
          <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "2px solid var(--border)", height: 160 }}>
            <NextImage src={photoUrl} alt="proof" fill style={{ objectFit: "cover" }} unoptimized />
            {gps && (
              <div style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(0,0,0,0.65)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "white", display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={11} /> {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
              </div>
            )}
            <button
              onClick={() => { setPhotoUrl(null); setPhotoBlob(null); if (fileRef.current) fileRef.current.value = ""; }}
              style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", width: 44, height: 44, color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleCameraClick}
            style={{ width: "100%", padding: "15px 16px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6C5CE7 0%, #FF6A00 100%)", color: "white", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
          >
            <Camera size={22} />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {gpsLoading
                  ? <><span className="th-text">กำลังหาตำแหน่ง…</span><span className="en-text">Getting location…</span></>
                  : <><span className="th-text">ถ่ายรูปหลักฐาน</span><span className="en-text">Photo proof</span></>}
              </div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>GPS captured automatically</div>
            </div>
          </button>
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFileChange} />

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", fontSize: 15, cursor: "pointer" }}>
            <span className="th-text">ยกเลิก</span><span className="en-text">Cancel</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6C5CE7, #4F46E5)", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving
              ? <><span className="th-text">กำลังบันทึก…</span><span className="en-text">Saving…</span></>
              : <><span className="th-text">มอบเงิน</span><span className="en-text">Give cash</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function MobileFinance({ todayWageTotal, pendingReceiptTotal, pendingAdvanceTotal, pendingReceipts, pendingAdvances, today, onPayReceipt, onPayAdvance, driverCashData, ownerId, userId }: any) {
  const [giveCashDriver, setGiveCashDriver] = useState<DriverCashEntry | null>(null);
  const [localCashDeltas, setLocalCashDeltas] = useState<Record<string, number>>({});

  function handleCashGiven(driverId: string, amount: number) {
    setLocalCashDeltas((prev) => ({ ...prev, [driverId]: (prev[driverId] ?? 0) + amount }));
    setGiveCashDriver(null);
  }

  return (
    <div>
      {giveCashDriver && (
        <GiveCashModalMobile
          driver={giveCashDriver.driver}
          ownerId={ownerId}
          userId={userId}
          onClose={() => setGiveCashDriver(null)}
          onDone={(amount: number) => handleCashGiven(giveCashDriver.driver.id, amount)}
        />
      )}
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>
            <span className="th-text">การเงิน</span>
            <span className="en-text">Finance</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>{formatThaiDate(today)}</p>
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <div className="mini-stat"><strong>฿{formatCurrency(todayWageTotal)}</strong><span className="th-text">ค่าแรง</span><span className="en-text">Wages</span></div>
          <div className="mini-stat"><strong style={{ color: "#F97316" }}>฿{formatCurrency(pendingReceiptTotal)}</strong><span className="th-text">ใบเสร็จ</span><span className="en-text">Receipts</span></div>
          <div className="mini-stat"><strong style={{ color: "#F59E0B" }}>฿{formatCurrency(pendingAdvanceTotal)}</strong><span className="th-text">เบิกค้าง</span><span className="en-text">Advances</span></div>
        </div>

        {driverCashData?.length > 0 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              <span className="th-text">เงินสดคนขับ</span>
              <span className="en-text" style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>Driver cash float</span>
            </div>
            {driverCashData.map((d: DriverCashEntry) => {
              const delta = localCashDeltas[d.driver.id] ?? 0;
              const balance = d.balance + delta;
              const totalGiven = d.totalGiven + delta;
              return (
                <div key={d.driver.id} style={{ background: "linear-gradient(145deg, var(--brand-violet) 0%, #4F46E5 100%)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, color: "white" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Wallet size={18} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{d.driver.name_th}</div>
                      <div style={{ fontSize: 11, opacity: 0.75 }}>
                        <span className="th-text">มีเงินในมือ</span>
                        <span className="en-text">Cash on hand</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>฿{formatCurrency(balance)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 14, fontSize: 12, opacity: 0.85, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.2)", marginBottom: 10 }}>
                    <span><span className="th-text">ได้รับ</span><span className="en-text">Given</span> ฿{formatCurrency(totalGiven)}</span>
                    <span><span className="th-text">ใช้แล้ว</span><span className="en-text">Spent</span> ฿{formatCurrency(d.totalSpent)}</span>
                  </div>
                  <button
                    onClick={() => setGiveCashDriver(d)}
                    style={{ width: "100%", background: "linear-gradient(135deg, #6C5CE7 0%, #FF6A00 100%)", border: "none", borderRadius: 10, padding: "12px 16px", color: "white", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                  >
                    <Camera size={20} />
                    <div style={{ textAlign: "left", flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        <span className="th-text">มอบเงิน</span>
                        <span className="en-text">Give cash</span>
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.8 }}>GPS + photo proof</div>
                    </div>
                    <X size={14} style={{ opacity: 0.6, transform: "rotate(45deg)" }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {pendingReceipts.length > 0 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              <span className="th-text">ใบเสร็จรอชำระ</span>
              <span className="en-text" style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>Pending receipts</span>
            </div>
            {pendingReceipts.slice(0, 5).map((r: any) => (
              <div key={r.id} style={{ background: "white", borderRadius: 8, padding: "12px 14px", marginBottom: 6, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 14 }}>{r.supplier?.name_th ?? "ไม่ระบุ"}</strong>
                  <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>{r.site?.name_th ?? ""}</small>
                </div>
                <strong style={{ fontSize: 15 }}>฿{formatCurrency(r.amount)}</strong>
                <button onClick={() => onPayReceipt(r.id)} className="btn-primary" style={{ padding: "6px 12px", fontSize: 13 }}>
                  <Check size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {pendingAdvances.length > 0 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
              <span className="th-text">เบิกค้างจ่าย</span>
              <span className="en-text" style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>Pending advances</span>
            </div>
            {pendingAdvances.slice(0, 5).map((a: any) => (
              <div key={a.id} style={{ background: "white", borderRadius: 8, padding: "12px 14px", marginBottom: 6, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <div className="avatar" style={{ width: 32, height: 32, fontSize: 11, flexShrink: 0, overflow: "hidden", padding: a.worker?.photo_url ? 0 : undefined }}>{a.worker?.photo_url ? <img src={a.worker.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (a.worker?.name_th?.[0] ?? "?")}</div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 14 }}>{a.worker?.name_th ?? "?"}</strong>
                  <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>{a.reason ?? "เบิกเงิน"}</small>
                </div>
                <strong style={{ fontSize: 15 }}>฿{formatCurrency(a.amount)}</strong>
                <button onClick={() => onPayAdvance(a.id)} className="btn-primary" style={{ padding: "6px 12px", fontSize: 13, background: "#F59E0B" }}>
                  <Check size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
