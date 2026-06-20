"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useUserRole } from "@/components/layout/UserRoleContext";
import {
  Search, CirclePlus, Camera, Check, X, Send,
  Receipt, Truck, AlertTriangle, Wallet, Plus, Clock, Download, MapPin, RefreshCw,
} from "lucide-react";
import { formatCurrency, formatThaiDate } from "@/lib/format";
import { parseThaiQR } from "@/lib/qr-parser";

const BRAND_KEYFRAMES = `
  @keyframes pulse-brand {
    0%, 100% { box-shadow: 0 4px 18px rgba(30,58,138,0.4); }
    50%       { box-shadow: 0 4px 32px rgba(255,106,0,0.65), 0 0 0 10px rgba(255,106,0,0.1); }
  }
  @keyframes pulse-ring {
    0%   { opacity: 0.6; transform: scale(1); }
    100% { opacity: 0;   transform: scale(1.7); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

type Supplier = {
  id: string;
  name_th: string;
  name_en: string;
  contact_phone: string | null;
  category: string | null;
  qr_code_data: string | null;
};

type ReceiptRow = {
  id: string;
  amount: number;
  status: string;
  category: string | null;
  description: string | null;
  photo_url: string | null;
  payment_type: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  created_at: string;
  site?: { id: string; name_th: string; name_en: string } | null;
  supplier?: { id: string; name_th: string; name_en: string } | null;
};

interface DriverCashSummary {
  driver: { id: string; name_th: string; name_en: string };
  totalGiven: number;
  totalSpent: number;
  balance: number;
}

interface PendingQrReceipt {
  id: string;
  amount: number;
  description: string | null;
  notes: string | null;
  qr_value: string | null;
  created_at: string;
  site?: { id: string; name_th: string; name_en: string } | null;
  scanned_by_user?: { name_th: string; name_en: string } | null;
}

interface SuppliersClientProps {
  suppliers: Supplier[];
  receipts: ReceiptRow[];
  sites: { id: string; name_th: string; name_en: string }[];
  ownerId: string;
  today: string;
  userId?: string;
  driverCashData: DriverCashSummary[];
  myBalance: { totalGiven: number; totalSpent: number; balance: number } | null;
  pendingQrReceipts: PendingQrReceipt[];
}

const RECEIPT_TABS = [
  { key: "all",      th: "ทั้งหมด",    en: "All" },
  { key: "pending",  th: "รอตรวจสอบ",  en: "Pending" },
  { key: "approved", th: "อนุมัติแล้ว", en: "Approved" },
  { key: "paid",     th: "จ่ายแล้ว",   en: "Paid" },
  { key: "disputed", th: "มีปัญหา",    en: "Disputed" },
];

export function SuppliersClient({
  suppliers: initSuppliers, receipts: initReceipts, sites, ownerId, today, userId,
  driverCashData, myBalance, pendingQrReceipts: initPendingQr,
}: SuppliersClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const { role, assignedSiteId } = useUserRole();
  const isDriverManager = role === "technical_admin";
  const [suppliers, setSuppliers] = useState(initSuppliers);
  const [receipts, setReceipts] = useState(initReceipts);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showAddReceipt, setShowAddReceipt] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRow | null>(null);
  const [giveCashDriver, setGiveCashDriver] = useState<DriverCashSummary | null>(null);
  const [pendingQr, setPendingQr] = useState(initPendingQr);
  const [openQrReceipt, setOpenQrReceipt] = useState<PendingQrReceipt | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 5000);
  }

  const filteredReceipts = useMemo(() => {
    const q = search.toLowerCase();
    return receipts.filter((r) => {
      const matchTab = tab === "all" || r.status === tab;
      const matchSearch = !q
        || (r.supplier?.name_th ?? "").toLowerCase().includes(q)
        || (r.site?.name_th ?? "").toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [receipts, tab, search]);

  const stats = useMemo(() => ({
    total:       receipts.length,
    pending:     receipts.filter((r) => r.status === "pending").length,
    totalAmount: receipts.reduce((s, r) => s + (r.amount ?? 0), 0),
    disputed:    receipts.filter((r) => r.status === "disputed").length,
  }), [receipts]);

  async function handleMarkPaid(id: string) {
    const { error } = await supabase.from("receipts").update({ status: "paid" }).eq("id", id);
    if (!error) {
      setReceipts((prev) => prev.map((r) => r.id === id ? { ...r, status: "paid" } : r));
      setSelectedReceipt(null);
      showToast("อัปเดตสถานะเป็น 'จ่ายแล้ว' · Marked as paid");
    }
  }

  async function handleApproveQr(id: string) {
    const { error } = await supabase
      .from("receipts")
      .update({ status: "paid", paid_at: new Date().toISOString(), paid_by: userId ?? null })
      .eq("id", id);
    if (!error) {
      setPendingQr((prev) => prev.filter((r) => r.id !== id));
      showToast("✓ ชำระ QR แล้ว · QR Payment confirmed");
    }
  }

  async function handleDispute(id: string) {
    const { error } = await supabase.from("receipts").update({ status: "disputed" }).eq("id", id);
    if (!error) {
      setReceipts((prev) => prev.map((r) => r.id === id ? { ...r, status: "disputed" } : r));
      setSelectedReceipt(null);
      showToast("รายงานปัญหาแล้ว · Marked as disputed");
    }
  }

  // ── Right panel ─────────────────────────────────────────────────────────────
  const rightPanel = (
    <>
      {pendingQr.length > 0 && !isDriverManager && (
        <section className="attention-card" style={{ borderLeft: "3px solid #F97316" }}>
          <h2 style={{ color: "#C2410C" }}>
            <Clock size={16} style={{ display: "inline", marginRight: 4 }} />
            QR รอชำระ <span>Pending QR Payments ({pendingQr.length})</span>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {pendingQr.map((r) => (
              <div
                key={r.id}
                onClick={() => setOpenQrReceipt(r)}
                style={{ padding: "10px 0", borderTop: "1px solid var(--border)", cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{r.description ?? "ไม่ระบุ"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {r.scanned_by_user?.name_th ?? "คนขับ"} · {r.site?.name_th ?? "-"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#C2410C" }}>฿{formatCurrency(r.amount)}</div>
                    <div style={{ fontSize: 11, color: "#F97316", marginTop: 2 }}>แตะเพื่อชำระ ▸</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="attention-card">
        <h2>สรุปใบเสร็จ <span>Receipt summary · 30 days</span></h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {[
            { th: "ทั้งหมด",   en: "Total receipts", val: stats.total },
            { th: "รอตรวจสอบ", en: "Pending",         val: stats.pending,     color: "#F97316" },
            { th: "มีปัญหา",   en: "Disputed",        val: stats.disputed,    color: "#EF4444" },
            { th: "ยอดรวม",    en: "Total amount",    val: `฿${formatCurrency(stats.totalAmount)}` },
          ].map((item) => (
            <div key={item.th} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-muted)" }}>{item.th} · {item.en}</span>
              <strong style={{ color: (item as any).color ?? "var(--text-primary)" }}>{item.val}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="attention-card">
        <h2>ซัพพลายเออร์ <span>Suppliers ({suppliers.length})</span></h2>
        {suppliers.slice(0, 5).map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
            <Truck size={16} color="var(--text-muted)" />
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 14 }}>{s.name_th}</strong>
              <small style={{ display: "block", color: "var(--text-muted)", fontSize: 11 }}>{s.name_en}</small>
            </div>
          </div>
        ))}
        <button
          className="attention-row"
          onClick={() => setShowAddSupplier(true)}
          style={{ justifyContent: "center", color: "var(--brand-primary)", fontWeight: 600, fontSize: 14 }}
        >
          <CirclePlus size={18} /> เพิ่มซัพพลายเออร์ · Add supplier
        </button>
      </section>

      {driverCashData.length > 0 && (
        <section className="attention-card">
          <h2>มอบเงินคนขับ <span>Driver cash float</span></h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {driverCashData.map((d) => (
              <div key={d.driver.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                <Wallet size={16} color="var(--text-muted)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{d.driver.name_th}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    ได้รับ ฿{formatCurrency(d.totalGiven)} · ใช้ ฿{formatCurrency(d.totalSpent)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: d.balance >= 0 ? "#15803D" : "#B91C1C" }}>
                    ฿{formatCurrency(d.balance)}
                  </div>
                  <button
                    onClick={() => setGiveCashDriver(d)}
                    style={{ marginTop: 2, background: "var(--brand-primary)", color: "white", border: "none", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
                  >
                    <Plus size={10} /> มอบเงิน
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedReceipt && (
        <section className="attention-card">
          <h2>ใบเสร็จที่เลือก <span>Selected receipt</span></h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {[
              { th: "ซัพพลายเออร์", val: selectedReceipt.supplier?.name_th ?? "-" },
              { th: "ยอด Amount",   val: `฿${formatCurrency(selectedReceipt.amount)}` },
            ].map((row) => (
              <div key={row.th} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--text-muted)" }}>{row.th}</span>
                <strong>{row.val}</strong>
              </div>
            ))}
            {selectedReceipt.payment_type && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--text-muted)" }}>ชำระ Payment</span>
                <span style={{ fontWeight: 700, color: selectedReceipt.payment_type === "qr" ? "#1D4ED8" : "#15803D" }}>
                  {selectedReceipt.payment_type === "qr" ? "🔷 QR" : "💵 Cash"}
                </span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--text-muted)" }}>สถานะ Status</span>
              <ReceiptStatusBadge status={selectedReceipt.status} />
            </div>
          </div>
          {selectedReceipt.status === "pending" && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => handleMarkPaid(selectedReceipt.id)} className="btn-primary" style={{ flex: 1, justifyContent: "center", fontSize: 13, padding: "8px" }}>
                <Check size={16} /> จ่ายแล้ว
              </button>
              <button onClick={() => handleDispute(selectedReceipt.id)} className="btn-primary" style={{ flex: 1, justifyContent: "center", fontSize: 13, padding: "8px", background: "#EF4444" }}>
                <AlertTriangle size={16} /> ปัญหา
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );

  return (
    <>
      <DashboardShell rightPanel={rightPanel}>
        {/* Desktop */}
        <div className="desktop-only">
          <div className="content-header">
            <div>
              <h1>ใบเสร็จ</h1>
              <p>Receipts · last 30 days</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-primary" style={{ background: "var(--brand-accent, #FF6A00)", color: "white", minWidth: 160 }} onClick={() => setShowAddSupplier(true)}>
                <Truck size={20} />
                เพิ่มซัพพลายเออร์
                <small>Add supplier</small>
              </button>
              <button className="btn-primary" style={{ minWidth: 160 }} onClick={() => setShowAddReceipt(true)}>
                <Camera size={20} />
                ถ่ายใบเสร็จ
                <small>Add receipt</small>
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <label className="search-box" style={{ maxWidth: 400 }}>
              <Search size={20} color="var(--text-muted)" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา / Supplier or site name" />
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {RECEIPT_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    padding: "6px 14px", borderRadius: 20,
                    border: "1px solid var(--border)",
                    background: tab === t.key ? "var(--brand-primary)" : "white",
                    color: tab === t.key ? "white" : "var(--text-primary)",
                    cursor: "pointer", fontSize: 13,
                    fontWeight: tab === t.key ? 600 : 400,
                  }}
                >
                  {t.th} <small style={{ opacity: 0.75 }}>{t.en}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="table-card">
            <div className="table-header" style={{ gridTemplateColumns: "1.5fr 1.2fr 80px 120px 100px 80px" }}>
              <span>ซัพพลายเออร์ <small>Supplier</small></span>
              <span>ไซต์ <small>Site</small></span>
              <span>หมวดหมู่ <small>Category</small></span>
              <span>ยอด <small>Amount</small></span>
              <span>สถานะ <small>Status</small></span>
              <span>วันที่ <small>Date</small></span>
            </div>
            {filteredReceipts.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                ไม่พบใบเสร็จ · No receipts found
              </div>
            ) : (
              filteredReceipts.map((r) => (
                <div
                  key={r.id}
                  className={`table-row ${selectedReceipt?.id === r.id ? "selected" : ""}`}
                  style={{ gridTemplateColumns: "1.5fr 1.2fr 80px 120px 70px 100px 80px", display: "grid", padding: "12px 20px", gap: 12, alignItems: "center", cursor: "pointer" }}
                  onClick={() => setSelectedReceipt(r)}
                >
                  <span>
                    <span className="cell-th">{r.supplier?.name_th ?? "ไม่ระบุ · None"}</span>
                    <span className="cell-en">{r.description ?? r.supplier?.name_en ?? ""}</span>
                  </span>
                  <span>
                    <span className="cell-th" style={{ fontSize: 14 }}>{r.site?.name_th ?? "-"}</span>
                    <span className="cell-en">{r.site?.name_en ?? ""}</span>
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.category ?? "-"}</span>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>฿{formatCurrency(r.amount)}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: r.payment_type === "qr" ? "#1D4ED8" : "#15803D" }}>
                    {r.payment_type === "qr" ? "🔷 QR" : "💵 Cash"}
                  </span>
                  <span><ReceiptStatusBadge status={r.status} /></span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatThaiDate(r.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mobile */}
        <div className="mobile-only">
          {isDriverManager ? (
            <DriverManagerMobile
              receipts={receipts}
              onAddReceipt={() => setShowAddReceipt(true)}
              myBalance={myBalance}
            />
          ) : (
            <>
              {pendingQr.length > 0 && (
                <PendingQrMobile pendingQr={pendingQr} onOpen={setOpenQrReceipt} />
              )}
              <MobileSuppliers
                suppliers={suppliers}
                receipts={filteredReceipts}
                stats={stats}
                tab={tab}
                setTab={setTab}
                search={search}
                setSearch={setSearch}
                onAddReceipt={() => setShowAddReceipt(true)}
                onAddSupplier={() => setShowAddSupplier(true)}
                onMarkPaid={handleMarkPaid}
                onDispute={handleDispute}
              />
            </>
          )}
        </div>

        {toast && <div className="toast">{toast}</div>}
      </DashboardShell>

      {showAddSupplier && (
        <AddSupplierModal
          ownerId={ownerId}
          onClose={() => setShowAddSupplier(false)}
          onAdded={(s) => { setSuppliers((prev) => [...prev, s]); setShowAddSupplier(false); showToast(`เพิ่ม ${s.name_th} แล้ว`); }}
        />
      )}

      {showAddReceipt && (
        <AddReceiptModal
          ownerId={ownerId}
          userId={userId}
          suppliers={suppliers}
          sites={sites}
          defaultSiteId={assignedSiteId ?? undefined}
          onClose={() => setShowAddReceipt(false)}
          onAdded={(r) => { setReceipts((prev) => [r, ...prev]); setShowAddReceipt(false); showToast(`เพิ่มใบเสร็จ ฿${formatCurrency(r.amount)} แล้ว`); }}
        />
      )}

      {openQrReceipt && (
        <QrPaymentModal
          receipt={openQrReceipt}
          userId={userId}
          onClose={() => setOpenQrReceipt(null)}
          onPaid={() => { handleApproveQr(openQrReceipt.id); setOpenQrReceipt(null); }}
        />
      )}

      {giveCashDriver && (
        <GiveCashModal
          driver={giveCashDriver.driver}
          ownerId={ownerId}
          userId={userId}
          onClose={() => setGiveCashDriver(null)}
          onDone={() => {
            const name = giveCashDriver?.driver.name_th ?? "";
            setGiveCashDriver(null);
            showToast(`✓ มอบเงินให้ ${name} แล้ว`);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────

function ReceiptStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; th: string; en: string }> = {
    pending:  { bg: "#FFF7ED", color: "#C2410C", th: "รอตรวจสอบ", en: "Pending" },
    approved: { bg: "#FFFBEB", color: "#B45309", th: "อนุมัติแล้ว", en: "Approved" },
    paid:     { bg: "#F0FDF4", color: "#15803D", th: "จ่ายแล้ว",   en: "Paid" },
    disputed: { bg: "#FEF2F2", color: "#B91C1C", th: "มีปัญหา",   en: "Disputed" },
  };
  const c = config[status] ?? { bg: "#F3F4F6", color: "#6B7280", th: status, en: status };
  return (
    <span style={{ background: c.bg, color: c.color, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, lineHeight: 1.3, display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      {c.th}<span style={{ fontSize: 9, opacity: 0.75, fontWeight: 500 }}>{c.en}</span>
    </span>
  );
}

// ── Photo preview screen (full-screen, after capture) ─────────────────────────

interface OcrResult { amount: number; description: string; merchant: string; confidence: number; }

function PhotoPreviewScreen({
  photoUrl, ocrLoading, ocrResult, ocrStatus, gps, paymentType, onRetake, onConfirm,
}: {
  photoUrl: string;
  ocrLoading: boolean;
  ocrResult: OcrResult | null;
  ocrStatus: "idle" | "low_confidence" | "no_result";
  gps: { lat: number; lng: number } | null;
  paymentType: "qr" | "cash" | null;
  onRetake: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#080808", display: "flex", flexDirection: "column" }}>
      <style>{BRAND_KEYFRAMES}</style>

      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 1,
        padding: "env(safe-area-inset-top, 16px) 20px 20px",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)",
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "white" }}>ตรวจสอบใบเสร็จ</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>Review receipt</div>
      </div>

      {/* Photo */}
      <img
        src={photoUrl}
        alt="receipt preview"
        style={{ width: "100%", height: "100%", objectFit: "contain", position: "absolute", inset: 0 }}
      />

      {/* Bottom overlay */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.85) 55%, transparent 100%)",
        padding: "24px 20px env(safe-area-inset-bottom, 24px)",
        display: "flex", flexDirection: "column", gap: 14,
        animation: "fadeSlideUp 0.3s ease",
      }}>
        {/* Payment type badge */}
        {paymentType && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>{paymentType === "qr" ? "🔷" : "💵"}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>
                {paymentType === "qr" ? "สแกน QR · QR Payment" : "เงินสดคนขับ · Driver Cash"}
              </span>
            </div>
            {paymentType === "qr" && (
              <div style={{
                background: "rgba(30,58,138,0.55)", border: "1px solid rgba(37,99,235,0.5)",
                borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.5,
              }}>
                📲 เจ้าของจะสแกน QR ผ่านแอปธนาคาร<br />
                <span style={{ opacity: 0.7 }}>Owner pays via banking app (PromptPay / transfer)</span>
              </div>
            )}
          </div>
        )}

        {/* GPS badge */}
        {gps && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <MapPin size={13} color="#34D399" />
            <span style={{ fontSize: 12, color: "#34D399", fontVariantNumeric: "tabular-nums" }}>
              {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
            </span>
          </div>
        )}

        {/* OCR result card */}
        {ocrLoading && (
          <div style={{ background: "rgba(108,92,231,0.88)", backdropFilter: "blur(8px)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ animation: "spin 0.9s linear infinite", display: "inline-block", fontSize: 20 }}>⏳</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>กำลังสแกน…</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Scanning receipt…</div>
            </div>
          </div>
        )}

        {!ocrLoading && ocrResult && ocrStatus === "idle" && (
          <div style={{ background: "rgba(6,95,70,0.88)", backdropFilter: "blur(8px)", borderRadius: 14, padding: "16px 18px", animation: "fadeSlideUp 0.25s ease" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>
              ✅ อ่านใบเสร็จแล้ว · Receipt read
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "white", lineHeight: 1 }}>
              ฿{Math.round(ocrResult.amount).toLocaleString()}
            </div>
            {ocrResult.description && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 6 }}>{ocrResult.description}</div>
            )}
            {ocrResult.merchant && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{ocrResult.merchant}</div>
            )}
          </div>
        )}

        {!ocrLoading && ocrStatus === "low_confidence" && (
          <div style={{ background: "rgba(146,64,14,0.88)", backdropFilter: "blur(8px)", borderRadius: 14, padding: "13px 16px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>⚠️ อ่านได้บางส่วน</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>Low confidence · กรุณาตรวจสอบ · Please verify manually</div>
          </div>
        )}

        {!ocrLoading && ocrStatus === "no_result" && (
          <div style={{ background: "rgba(153,27,27,0.88)", backdropFilter: "blur(8px)", borderRadius: 14, padding: "13px 16px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>❌ อ่านไม่ได้</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>Could not read · กรอกข้อมูลเอง · Fill in manually</div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <button
            onClick={onRetake}
            style={{
              flex: 1, padding: "15px 0", borderRadius: 14,
              background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.25)",
              color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <RefreshCw size={17} /> ถ่ายใหม่
            <span style={{ fontSize: 11, opacity: 0.7 }}>Retake</span>
          </button>
          <button
            onClick={onConfirm}
            disabled={ocrLoading}
            style={{
              flex: 2, padding: "15px 0", borderRadius: 14, border: "none",
              background: ocrLoading
                ? "rgba(255,255,255,0.2)"
                : "linear-gradient(135deg, #1E3A8A 0%, #FF6A00 100%)",
              color: "white", fontSize: 15, fontWeight: 700,
              cursor: ocrLoading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: ocrLoading ? "none" : "0 4px 24px rgba(255,106,0,0.45)",
              animation: ocrLoading ? "none" : "pulse-brand 2.2s ease-in-out infinite",
            }}
          >
            <Send size={20} />
            {ocrLoading
              ? "กำลังอ่าน…"
              : paymentType === "qr"
                ? "ส่ง QR ให้เจ้าของ · Send QR"
                : "ส่งให้เจ้าของ · Send to Owner"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Driver Manager mobile view ────────────────────────────────────────────────

function DriverManagerMobile({ receipts, onAddReceipt, myBalance }: {
  receipts: ReceiptRow[];
  onAddReceipt: () => void;
  myBalance: { totalGiven: number; totalSpent: number; balance: number } | null;
}) {
  return (
    <div>
      <style>{BRAND_KEYFRAMES}</style>
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>ใบเสร็จ</h1>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>Receipts · Driver Manager</p>
        </div>
      </div>

      <div style={{ padding: "16px 16px 12px" }}>
        {myBalance !== null && (
          <div style={{
            background: myBalance.balance > 0
              ? "linear-gradient(135deg, #1E3A8A, #3B82F6)"
              : "linear-gradient(135deg, #7f1d1d, #ef4444)",
            borderRadius: 14, padding: "16px 18px", color: "white", marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Wallet size={18} />
              <span style={{ fontSize: 13, opacity: 0.85 }}>มีเงินในมือ · Cash on hand</span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>
              ฿{formatCurrency(myBalance.balance)}
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.2)", fontSize: 12, opacity: 0.85 }}>
              <span>ได้รับ ฿{formatCurrency(myBalance.totalGiven)}</span>
              <span>ใช้แล้ว ฿{formatCurrency(myBalance.totalSpent)}</span>
            </div>
          </div>
        )}

        {/* Animated camera button */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          {/* Pulsing ring */}
          <div style={{
            position: "absolute", inset: -6, borderRadius: 20,
            background: "rgba(255,106,0,0.25)",
            animation: "pulse-ring 1.8s ease-out infinite",
          }} />
          <button
            onClick={onAddReceipt}
            style={{
              position: "relative", width: "100%", padding: "20px",
              borderRadius: 14, border: "none",
              background: "linear-gradient(135deg, #1E3A8A 0%, #FF6A00 100%)",
              color: "white", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 12, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(255,106,0,0.4)",
              animation: "pulse-brand 2.2s ease-in-out infinite",
            }}
          >
            <Camera size={30} />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>ถ่ายรูปใบเสร็จ</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Capture Receipt · OCR auto-fill</div>
            </div>
          </button>
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
          ใบเสร็จล่าสุด · Recent submissions
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {receipts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: 14 }}>
              ยังไม่มีใบเสร็จ · No receipts yet
            </div>
          ) : (
            receipts.slice(0, 20).map((r) => (
              <div key={r.id} style={{ background: "white", borderRadius: 10, padding: "14px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 15 }}>{r.supplier?.name_th ?? "ไม่ระบุ · None"}</strong>
                  <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
                    {r.site?.name_en ?? r.site?.name_th ?? "-"} · {formatThaiDate(r.created_at)}
                  </small>
                  {r.description && (
                    <small style={{ display: "block", color: "var(--text-muted)", fontSize: 11, marginTop: 1 }}>{r.description}</small>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                  <strong style={{ fontSize: 16 }}>฿{formatCurrency(r.amount)}</strong>
                  <div style={{ marginTop: 4 }}><ReceiptStatusBadge status={r.status} /></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pending QR mobile banner ──────────────────────────────────────────────────

function PendingQrMobile({ pendingQr, onOpen }: { pendingQr: PendingQrReceipt[]; onOpen: (r: PendingQrReceipt) => void }) {
  return (
    <div style={{ padding: "12px 16px 0" }}>
      <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Clock size={16} color="#C2410C" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#C2410C" }}>
            QR รอชำระ · Pending QR ({pendingQr.length})
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pendingQr.map((r) => (
            <div
              key={r.id}
              onClick={() => onOpen(r)}
              style={{ background: "white", borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.description ?? "ไม่ระบุ"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {r.scanned_by_user?.name_th ?? "คนขับ"} · {r.site?.name_th ?? "-"}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#C2410C" }}>฿{formatCurrency(r.amount)}</div>
                <div style={{ fontSize: 11, color: "#F97316", marginTop: 2 }}>แตะเพื่อชำระ ▸</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── QR Payment modal ──────────────────────────────────────────────────────────

function QrPaymentModal({ receipt, userId, onClose, onPaid }: {
  receipt: PendingQrReceipt;
  userId?: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrReady, setQrReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const parsed = receipt.qr_value ? parseThaiQR(receipt.qr_value) : null;
  const merchantName = receipt.description ?? parsed?.merchantName ?? "ไม่ระบุ";
  const amount = receipt.amount ?? parsed?.amount ?? 0;
  const accountId = parsed?.accountId ?? null;

  useEffect(() => {
    if (!receipt.qr_value || !canvasRef.current) return;
    import("qrcode").then(({ default: QRCode }) => {
      QRCode.toCanvas(canvasRef.current!, receipt.qr_value!, {
        width: 260, margin: 2,
        color: { dark: "#1E3A8A", light: "#FFFFFF" },
      }, (err) => { if (!err) setQrReady(true); });
    });
  }, [receipt.qr_value]);

  async function handleSaveQr() {
    if (!canvasRef.current) return;
    const blob: Blob = await new Promise((res) => canvasRef.current!.toBlob(res as any, "image/png"));
    const file = new File([blob], `qr-payment-${Date.now()}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: merchantName });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = file.name; a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 360, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ background: "linear-gradient(135deg, #1E3A8A, #FF6A00)", padding: "20px 20px 16px", color: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                QR รอชำระ · Payment Request
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{merchantName}</div>
              {accountId && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{accountId}</div>}
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                {receipt.scanned_by_user?.name_th ?? "คนขับ"} · {receipt.site?.name_th ?? "-"}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, marginTop: 12 }}>฿{formatCurrency(amount)}</div>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ background: "#F0F4FF", borderRadius: 16, padding: 16, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #C7D7FF" }}>
            <canvas ref={canvasRef} style={{ display: qrReady ? "block" : "none", borderRadius: 8 }} />
            {!qrReady && (
              <div style={{ width: 260, height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 13 }}>
                {receipt.qr_value ? "กำลังโหลด QR…" : "ไม่มีข้อมูล QR"}
              </div>
            )}
          </div>

          {receipt.notes && (
            <div style={{ background: "#FFF7ED", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#92400E", width: "100%" }}>
              {receipt.notes}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            {receipt.qr_value && (
              <button
                onClick={handleSaveQr}
                style={{ padding: "13px", borderRadius: 12, border: "2px solid #1E3A8A", background: "white", color: "#1E3A8A", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Download size={18} /> บันทึก QR · Save QR
              </button>
            )}
            <button
              onClick={() => { setSaving(true); onPaid(); }}
              disabled={saving}
              style={{ padding: "14px", borderRadius: 12, border: "none", background: saving ? "#9CA3AF" : "linear-gradient(135deg, #15803D, #16A34A)", color: "white", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Check size={20} /> {saving ? "กำลังบันทึก…" : "ชำระแล้ว · Mark Paid"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile suppliers (owner / field manager view) ─────────────────────────────

function MobileSuppliers({ suppliers, receipts, stats, tab, setTab, search, setSearch, onAddReceipt, onAddSupplier, onMarkPaid, onDispute }: any) {
  return (
    <div>
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>ใบเสร็จ</h1>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>Receipts</p>
        </div>
        <button onClick={onAddReceipt} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer" }}>
          <CirclePlus size={24} />
        </button>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <div className="mini-stat"><strong>{stats.total}</strong><span>ใบเสร็จ</span><small>Receipts</small></div>
          <div className="mini-stat"><strong style={{ color: "#F97316" }}>{stats.pending}</strong><span>รอตรวจ</span><small>Pending</small></div>
          <div className="mini-stat"><strong>฿{formatCurrency(stats.totalAmount)}</strong><span>ยอดรวม</span><small>Total</small></div>
        </div>

        <label className="search-box">
          <Search size={20} color="var(--text-muted)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา" />
        </label>

        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {RECEIPT_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flexShrink: 0, padding: "6px 12px", borderRadius: 20,
                border: "1px solid var(--border)",
                background: tab === t.key ? "var(--brand-primary)" : "white",
                color: tab === t.key ? "white" : "var(--text-primary)",
                cursor: "pointer", fontSize: 11, fontWeight: tab === t.key ? 600 : 400,
                lineHeight: 1.3, textAlign: "center",
              }}
            >
              <div>{t.th}</div>
              <div style={{ fontSize: 9, opacity: 0.8 }}>{t.en}</div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {receipts.map((r: ReceiptRow) => (
            <div key={r.id} style={{ background: "white", borderRadius: 10, padding: "14px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong style={{ fontSize: 15 }}>{r.supplier?.name_th ?? "ไม่ระบุ · None"}</strong>
                  <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>
                    {r.site?.name_en ?? r.site?.name_th ?? "-"} · {formatThaiDate(r.created_at)}
                  </small>
                  {r.payment_type && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4,
                      fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
                      background: r.payment_type === "qr" ? "#EFF6FF" : "#F0FDF4",
                      color:      r.payment_type === "qr" ? "#1D4ED8" : "#15803D",
                    }}>
                      {r.payment_type === "qr" ? "🔷 QR" : "💵 Cash"}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: 16 }}>฿{formatCurrency(r.amount)}</strong>
                  <div style={{ marginTop: 2 }}><ReceiptStatusBadge status={r.status} /></div>
                </div>
              </div>
              {r.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <button onClick={() => onMarkPaid(r.id)} className="btn-primary" style={{ flex: 1, justifyContent: "center", fontSize: 13, padding: "8px" }}>
                    <Check size={15} /> จ่ายแล้ว
                  </button>
                  <button onClick={() => onDispute(r.id)} className="btn-primary" style={{ flex: 1, justifyContent: "center", fontSize: 13, padding: "8px", background: "#EF4444" }}>
                    <AlertTriangle size={15} /> ปัญหา
                  </button>
                </div>
              )}
            </div>
          ))}
          {receipts.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: 14 }}>
              ไม่พบใบเสร็จ · No receipts
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add supplier modal ────────────────────────────────────────────────────────

function AddSupplierModal({ ownerId, onClose, onAdded }: { ownerId: string; onClose: () => void; onAdded: (s: Supplier) => void }) {
  const supabase = createClient();
  const [form, setForm] = useState({ name_th: "", name_en: "", contact_phone: "", category: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!form.name_th || !form.name_en) { setError("กรุณากรอกชื่อ · Name required"); return; }
    setSaving(true);
    const response = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name_th: form.name_th, name_en: form.name_en, contact_phone: form.contact_phone || null, category: form.category || null }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { setError(result.error ?? "Error adding supplier"); return; }
    onAdded(result.data as Supplier);
  }

  return (
    <ModalWrapper title="เพิ่มซัพพลายเออร์" subtitle="Add supplier" onClose={onClose}>
      {error && <ErrorBox msg={error} />}
      <FormField label="ชื่อ (ไทย) *" value={form.name_th} onChange={(v) => setForm((f) => ({ ...f, name_th: v }))} placeholder="บริษัทก่อสร้าง" />
      <FormField label="Name (English) *" value={form.name_en} onChange={(v) => setForm((f) => ({ ...f, name_en: v }))} placeholder="Construction Co." />
      <FormField label="เบอร์โทร Phone" value={form.contact_phone} onChange={(v) => setForm((f) => ({ ...f, contact_phone: v }))} placeholder="0812345678" />
      <FormField label="หมวดหมู่ Category" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} placeholder="วัสดุก่อสร้าง / Material" />
      <ModalActions onCancel={onClose} onSave={handleSave} saving={saving} />
    </ModalWrapper>
  );
}

// ── Give cash modal ───────────────────────────────────────────────────────────

function GiveCashModal({ driver, ownerId, userId, onClose, onDone }: {
  driver: { id: string; name_th: string; name_en: string };
  ownerId: string;
  userId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError("กรอกยอดที่ถูกต้อง · Valid amount required"); return; }
    setSaving(true);
    const { error: dbError } = await supabase
      .from("driver_cash_entries")
      .insert({ owner_id: ownerId, driver_user_id: driver.id, amount: amt, notes: notes || null, given_by: userId ?? null });
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    onDone();
  }

  return (
    <ModalWrapper title="มอบเงินคนขับ" subtitle="Give cash to driver" onClose={onClose}>
      {error && <ErrorBox msg={error} />}
      <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <Wallet size={20} color="var(--brand-primary)" />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{driver.name_th}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{driver.name_en} · Driver Manager</div>
        </div>
      </div>
      <FormField label="ยอดเงิน Amount ฿ *" value={amount} onChange={setAmount} type="number" placeholder="0" />
      <FormField label="หมายเหตุ Notes" value={notes} onChange={setNotes} placeholder="ค่าวัสดุสำหรับไซต์…" />
      <ModalActions onCancel={onClose} onSave={handleSave} saving={saving} saveLabel="มอบเงิน · Give cash" />
    </ModalWrapper>
  );
}

// ── Payment type choice overlay ───────────────────────────────────────────────

function PaymentTypeChoiceOverlay({ onChoose, onCancel }: {
  onChoose: (type: "qr" | "cash") => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10001,
      background: "rgba(0,0,0,0.88)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 16, padding: 28,
    }}>
      <style>{BRAND_KEYFRAMES}</style>

      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>เลือกประเภทการชำระ</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>Choose payment type</div>
      </div>

      {/* QR */}
      <button
        onClick={() => onChoose("qr")}
        style={{
          width: "100%", maxWidth: 360, padding: "22px 20px",
          background: "linear-gradient(135deg, #1E3A8A, #3B82F6)",
          border: "none", borderRadius: 16, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 16, color: "white",
          boxShadow: "0 4px 24px rgba(30,58,138,0.5)",
          animation: "pulse-brand 2.5s ease-in-out infinite",
        }}
      >
        <span style={{ fontSize: 34, lineHeight: 1 }}>🔷</span>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>สแกน QR</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>QR Code Payment</div>
        </div>
      </button>

      {/* Cash */}
      <button
        onClick={() => onChoose("cash")}
        style={{
          width: "100%", maxWidth: 360, padding: "22px 20px",
          background: "linear-gradient(135deg, #FF6A00, #FF9500)",
          border: "none", borderRadius: 16, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 16, color: "white",
          boxShadow: "0 4px 24px rgba(255,106,0,0.45)",
        }}
      >
        <span style={{ fontSize: 34, lineHeight: 1 }}>💵</span>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>เงินสดคนขับ</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Driver Cash</div>
        </div>
      </button>

      <button
        onClick={onCancel}
        style={{ color: "rgba(255,255,255,0.45)", background: "transparent", border: "none", fontSize: 13, cursor: "pointer", marginTop: 4 }}
      >
        ยกเลิก · Cancel
      </button>
    </div>
  );
}

// ── Add receipt modal — with photo preview + OCR + GPS ────────────────────────

function AddReceiptModal({ ownerId, userId, suppliers, sites, defaultSiteId, onClose, onAdded }: {
  ownerId: string;
  userId?: string;
  suppliers: Supplier[];
  sites: { id: string; name_th: string; name_en: string }[];
  defaultSiteId?: string;
  onClose: () => void;
  onAdded: (r: ReceiptRow) => void;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers);
  const [form, setForm] = useState({
    supplier_id: "",
    site_id: defaultSiteId ?? sites[0]?.id ?? "",
    amount: "",
    category: "",
    description: "",
  });
  const [photoUrl, setPhotoUrl]   = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showPaymentChoice, setShowPaymentChoice] = useState(false);
  const [paymentType, setPaymentType] = useState<"qr" | "cash" | null>(null);
  const [ocrLoading, setOcrLoading]   = useState(false);
  const [ocrResult, setOcrResult]     = useState<OcrResult | null>(null);
  const [ocrStatus, setOcrStatus]     = useState<"idle" | "low_confidence" | "no_result">("idle");
  const [gps, setGps]               = useState<{ lat: number; lng: number } | null>(null);
  const [newSupplierName, setNewSupplierName] = useState<string | null>(null);
  const [addingSupplier, setAddingSupplier]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  function handleCameraClick() {
    setShowPaymentChoice(true);
  }

  function handleChoosePaymentType(type: "qr" | "cash") {
    setPaymentType(type);
    setShowPaymentChoice(false);
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoBlob(file);
    setOcrStatus("idle");
    setOcrResult(null);
    setNewSupplierName(null);
    setError("");
    setGps(null);
    setPhotoUrl(URL.createObjectURL(file));
    setShowPreview(true);
    setOcrLoading(true);

    // Capture GPS
    navigator.geolocation?.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 6000, maximumAge: 0 }
    );

    try {
      // Resize to max 1024px (avoids iOS memory crash)
      const base64 = await new Promise<string>((resolve, reject) => {
        const blobUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error("Image load failed")); };
        img.onload = () => {
          URL.revokeObjectURL(blobUrl);
          const maxPx = 1024;
          const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width  = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78).split(",")[1]);
        };
        img.src = blobUrl;
      });

      const ocrRes = await fetch("/api/receipts/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, ownerId }),
      });
      const ocr = await ocrRes.json();

      if (ocr._err) {
        setError(`OCR: ${ocr._err}`);
        setOcrStatus("no_result");
      } else if (ocr.confidence >= 60 && ocr.amount > 0) {
        setOcrResult(ocr);
        setOcrStatus("idle");
      } else if (ocr.confidence > 0) {
        setOcrStatus("low_confidence");
      } else {
        setOcrStatus("no_result");
      }
    } catch (err: any) {
      setError(`ข้อผิดพลาด · Error: ${err.message}`);
      setOcrStatus("no_result");
    } finally {
      setOcrLoading(false);
    }
  }

  function handleConfirmPreview() {
    if (ocrResult) {
      setForm((f) => ({
        ...f,
        amount:      String(Math.round(ocrResult.amount)),
        description: ocrResult.description || f.description,
      }));
      if (ocrResult.merchant) {
        const term = ocrResult.merchant.toLowerCase();
        const matched = localSuppliers.find(
          (s) =>
            s.name_th.toLowerCase().includes(term) ||
            s.name_en.toLowerCase().includes(term) ||
            term.includes(s.name_th.toLowerCase())
        );
        if (matched) {
          setForm((f) => ({ ...f, supplier_id: matched.id }));
        } else {
          setNewSupplierName(ocrResult.merchant);
        }
      }
    }
    setShowPreview(false);
  }

  function handleRetakePhoto() {
    setShowPreview(false);
    setPhotoUrl(null);
    setPhotoBlob(null);
    setOcrResult(null);
    setOcrStatus("idle");
    setGps(null);
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => fileInputRef.current?.click(), 80);
  }

  async function handleAddDetectedSupplier() {
    if (!newSupplierName) return;
    setAddingSupplier(true);
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name_th: newSupplierName, name_en: newSupplierName, contact_phone: null, category: null }),
    });
    const result = await res.json();
    setAddingSupplier(false);
    if (res.ok && result.data) {
      setLocalSuppliers((prev) => [...prev, result.data as Supplier]);
      setForm((f) => ({ ...f, supplier_id: result.data.id }));
    }
    setNewSupplierName(null);
  }

  async function handleSave() {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { setError("กรอกยอดที่ถูกต้อง · Valid amount required"); return; }
    setSaving(true);

    let storedPhotoUrl: string | null = null;
    if (photoBlob) {
      const fileName = `receipts/${ownerId}/${Date.now()}.jpg`;
      const { data: uploadData } = await supabase.storage
        .from("receipt-photos")
        .upload(fileName, photoBlob, { contentType: "image/jpeg" });
      if (uploadData) {
        const { data: urlData } = supabase.storage.from("receipt-photos").getPublicUrl(fileName);
        storedPhotoUrl = urlData?.publicUrl ?? null;
      }
    }

    const receiptNumber = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data, error: dbError } = await supabase
      .from("receipts")
      .insert({
        owner_id:      ownerId,
        submitted_by:  userId,
        receipt_number: receiptNumber,
        supplier_id:   form.supplier_id || null,
        site_id:       form.site_id || null,
        amount:        amt,
        category:      form.category || null,
        description:   form.description || null,
        photo_url:     storedPhotoUrl,
        status:        "pending",
        payment_type:  paymentType ?? "cash",
        gps_lat:       gps?.lat ?? null,
        gps_lng:       gps?.lng ?? null,
      })
      .select("*, site:site_id(id, name_th, name_en), supplier:supplier_id(id, name_th, name_en)")
      .single();
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }

    // Push notification to owner
    const siteName = (data as any)?.site?.name_th ?? "";
    const payLabel = paymentType === "qr" ? "QR" : "เงินสด";
    fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_id:          ownerId,
        title:             "ใบเสร็จใหม่ · New Receipt",
        body:              `฿${formatCurrency(amt)}${siteName ? ` · ${siteName}` : ""}${form.description ? ` · ${form.description}` : ""} · ${payLabel}`,
        url:               "/suppliers",
        tag:               "new_receipt",
        requireInteraction: true,
      }),
    }).catch(() => {});

    if (storedPhotoUrl) {
      fetch("/api/receipts/ocr/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId, imageUrl: storedPhotoUrl, description: form.description || null, amount: amt, merchant: null, date: new Date().toISOString().slice(0, 10) }),
      }).catch(() => {});
    }

    onAdded(data as ReceiptRow);
  }

  // Payment type choice (before camera)
  if (showPaymentChoice) {
    return (
      <PaymentTypeChoiceOverlay
        onChoose={handleChoosePaymentType}
        onCancel={() => setShowPaymentChoice(false)}
      />
    );
  }

  // Photo preview fullscreen overlay
  if (showPreview && photoUrl) {
    return (
      <PhotoPreviewScreen
        photoUrl={photoUrl}
        ocrLoading={ocrLoading}
        ocrResult={ocrResult}
        ocrStatus={ocrStatus}
        gps={gps}
        paymentType={paymentType}
        onRetake={handleRetakePhoto}
        onConfirm={handleConfirmPreview}
      />
    );
  }

  return (
    <ModalWrapper title="ใบเสร็จ" subtitle="Add receipt" onClose={onClose}>
      <style>{BRAND_KEYFRAMES}</style>
      {error && <ErrorBox msg={error} />}

      {/* New supplier detected */}
      {newSupplierName && (
        <div style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1E40AF" }}>
            🔍 พบซัพพลายเออร์ใหม่ · New supplier detected
          </div>
          <div style={{ fontSize: 14, color: "#1E3A8A" }}>
            <strong>"{newSupplierName}"</strong> ไม่พบในรายการ · Not in your list
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleAddDetectedSupplier}
              disabled={addingSupplier}
              style={{ flex: 1, padding: "9px 12px", background: "var(--brand-primary)", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              {addingSupplier ? "…" : "✅ เพิ่มซัพพลายเออร์ · Add supplier"}
            </button>
            <button
              onClick={() => setNewSupplierName(null)}
              style={{ padding: "9px 14px", background: "transparent", border: "1px solid #BFDBFE", borderRadius: 8, fontSize: 13, color: "#6B7280", cursor: "pointer" }}
            >
              ข้าม · Skip
            </button>
          </div>
        </div>
      )}

      {/* OCR low confidence */}
      {ocrStatus === "low_confidence" && (
        <div style={{ background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#92400E" }}>
          ⚠️ อ่านได้บางส่วน · Low confidence — กรุณาตรวจสอบ · Please verify manually.
        </div>
      )}
      {ocrStatus === "no_result" && (
        <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#991B1B" }}>
          ❌ อ่านไม่ได้ · Could not read receipt — กรอกเอง · Fill in manually.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1/-1" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>ซัพพลายเออร์ Supplier</span>
          <select value={form.supplier_id} onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))} style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}>
            <option value="">ไม่ระบุ · None</option>
            {localSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name_th}</option>)}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1/-1" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>ไซต์ Site</span>
          <select value={form.site_id} onChange={(e) => setForm((f) => ({ ...f, site_id: e.target.value }))} style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}>
            <option value="">ไม่ระบุ · None</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name_th}</option>)}
          </select>
        </label>

        <FormField label="ยอดเงิน Amount ฿ *" value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} type="number" placeholder="0" />
        <FormField label="หมวดหมู่ Category" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} placeholder="วัสดุ" />
        <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1/-1" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>คำอธิบาย Description</span>
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="รายละเอียดใบเสร็จ" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
        </label>
      </div>

      {/* Camera / photo area */}
      <div style={{ marginTop: 4 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {photoUrl ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <img src={photoUrl} alt="receipt" style={{ width: "100%", maxWidth: 240, height: 160, objectFit: "cover", borderRadius: 8 }} />
              <button
                onClick={() => { setPhotoUrl(null); setPhotoBlob(null); setOcrStatus("idle"); setOcrResult(null); setNewSupplierName(null); }}
                style={{ position: "absolute", top: 6, right: 6, background: "#EF4444", border: "none", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={14} color="white" />
              </button>
            </div>
            {/* GPS badge on form */}
            {gps && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#059669" }}>
                <MapPin size={12} /> {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
              </div>
            )}
            {!ocrLoading && ocrStatus === "idle" && form.amount && (
              <div style={{ fontSize: 13, color: "#065F46", background: "#ECFDF5", padding: "8px 12px", borderRadius: 8 }}>
                ✅ อ่านใบเสร็จแล้ว · Receipt read — ฿{form.amount}
              </div>
            )}
          </div>
        ) : (
          <>
            {paymentType && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: paymentType === "qr" ? "#EFF6FF" : "#FFF7ED", borderRadius: 8, fontSize: 13, fontWeight: 600, color: paymentType === "qr" ? "#1E40AF" : "#C2410C" }}>
                <span>{paymentType === "qr" ? "🔷" : "💵"}</span>
                {paymentType === "qr" ? "สแกน QR · QR Payment" : "เงินสดคนขับ · Driver Cash"}
                <button onClick={() => setPaymentType(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            )}
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", inset: -5, borderRadius: 15,
                background: "rgba(255,106,0,0.2)",
                animation: "pulse-ring 2s ease-out infinite",
              }} />
              <button
                onClick={handleCameraClick}
                style={{
                  position: "relative",
                  display: "flex", alignItems: "center", gap: 12,
                  width: "100%", padding: "18px 16px",
                  background: "linear-gradient(135deg, #1E3A8A 0%, #FF6A00 100%)",
                  border: "none", borderRadius: 12, cursor: "pointer",
                  color: "white",
                  animation: "pulse-brand 2.2s ease-in-out infinite",
                  boxShadow: "0 4px 18px rgba(255,106,0,0.35)",
                }}
              >
                <Camera size={26} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>ถ่ายรูปใบเสร็จ</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>Capture Receipt · Opens camera</div>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      <ModalActions onCancel={onClose} onSave={handleSave} saving={saving}
        saveLabel={paymentType === "qr" ? "ส่ง QR ให้เจ้าของ · Send QR" : "ส่งใบเสร็จ · Send"} />
    </ModalWrapper>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function ModalWrapper({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{title} <small style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>{subtitle}</small></h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={24} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
    </label>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 14 }}>{msg}</div>;
}

function ModalActions({ onCancel, onSave, saving, saveLabel = "บันทึก · Save" }: { onCancel: () => void; onSave: () => void; saving: boolean; saveLabel?: string }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={onCancel} style={{ flex: 1, padding: "11px", border: "1px solid var(--border)", borderRadius: 10, background: "white", cursor: "pointer", fontSize: 14 }}>
        ยกเลิก · Cancel
      </button>
      <button onClick={onSave} disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: "center" }}>
        {saving ? "กำลังบันทึก…" : saveLabel}
      </button>
    </div>
  );
}
