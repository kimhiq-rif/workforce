"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useUserRole } from "@/components/layout/UserRoleContext";
import {
  Search, CirclePlus, Camera, Check, X, ChevronRight,
  QrCode, Receipt, Truck, AlertTriangle, Wallet, Plus, Clock,
} from "lucide-react";
import { formatCurrency, formatThaiDate, formatTime } from "@/lib/format";

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
  { key: "all", th: "ทั้งหมด", en: "All" },
  { key: "pending", th: "รอตรวจสอบ", en: "Pending" },
  { key: "approved", th: "อนุมัติแล้ว", en: "Approved" },
  { key: "paid", th: "จ่ายแล้ว", en: "Paid" },
  { key: "disputed", th: "มีปัญหา", en: "Disputed" },
];

export function SuppliersClient({ suppliers: initSuppliers, receipts: initReceipts, sites, ownerId, today, userId, driverCashData, myBalance, pendingQrReceipts: initPendingQr }: SuppliersClientProps) {
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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 5000);
  }

  const filteredReceipts = useMemo(() => {
    const q = search.toLowerCase();
    return receipts.filter((r) => {
      const matchTab = tab === "all" || r.status === tab;
      const matchSearch = !q || (r.supplier?.name_th ?? "").toLowerCase().includes(q) || (r.site?.name_th ?? "").toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [receipts, tab, search]);

  const stats = useMemo(() => ({
    total: receipts.length,
    pending: receipts.filter((r) => r.status === "pending").length,
    totalAmount: receipts.reduce((s, r) => s + (r.amount ?? 0), 0),
    disputed: receipts.filter((r) => r.status === "disputed").length,
  }), [receipts]);

  async function handleMarkPaid(id: string) {
    const { error } = await supabase
      .from("receipts")
      .update({ status: "paid" })
      .eq("id", id);

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
    const { error } = await supabase
      .from("receipts")
      .update({ status: "disputed" })
      .eq("id", id);

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
              <div key={r.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{r.description ?? "ไม่ระบุ"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {r.scanned_by_user?.name_th ?? "คนขับ"} · {r.site?.name_th ?? "-"}
                    </div>
                    {r.notes && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.notes}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#C2410C" }}>฿{formatCurrency(r.amount)}</div>
                    <button
                      onClick={() => handleApproveQr(r.id)}
                      style={{ marginTop: 4, background: "#15803D", color: "white", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
                    >
                      <Check size={11} /> ชำระแล้ว
                    </button>
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
            { th: "ทั้งหมด", en: "Total receipts", val: stats.total },
            { th: "รอตรวจสอบ", en: "Pending", val: stats.pending, color: "#F97316" },
            { th: "มีปัญหา", en: "Disputed", val: stats.disputed, color: "#EF4444" },
            { th: "ยอดรวม", en: "Total amount", val: `฿${formatCurrency(stats.totalAmount)}` },
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
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--text-muted)" }}>ซัพพลายเออร์</span>
              <strong>{selectedReceipt.supplier?.name_th ?? "-"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--text-muted)" }}>ยอด</span>
              <strong>฿{formatCurrency(selectedReceipt.amount)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--text-muted)" }}>สถานะ</span>
              <ReceiptStatusBadge status={selectedReceipt.status} />
            </div>
          </div>
          {selectedReceipt.status === "pending" && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                onClick={() => handleMarkPaid(selectedReceipt.id)}
                className="btn-primary"
                style={{ flex: 1, justifyContent: "center", fontSize: 13, padding: "8px" }}
              >
                <Check size={16} /> จ่ายแล้ว
              </button>
              <button
                onClick={() => handleDispute(selectedReceipt.id)}
                className="btn-primary"
                style={{ flex: 1, justifyContent: "center", fontSize: 13, padding: "8px", background: "#EF4444" }}
              >
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
              <h1>ซัพพลายเออร์ & ใบเสร็จ</h1>
              <p>Suppliers & Receipts · last 30 days</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-primary" style={{ background: "var(--brand-accent, #FF6A00)", color: "white", minWidth: 160 }} onClick={() => setShowAddSupplier(true)}>
                <Truck size={20} />
                เพิ่มซัพพลายเออร์
                <small>Add supplier</small>
              </button>
              <button className="btn-primary" style={{ minWidth: 160 }} onClick={() => setShowAddReceipt(true)}>
                <Receipt size={20} />
                เพิ่มใบเสร็จ
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
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: "1px solid var(--border)",
                    background: tab === t.key ? "var(--brand-primary)" : "white",
                    color: tab === t.key ? "white" : "var(--text-primary)",
                    cursor: "pointer",
                    fontSize: 13,
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
                  style={{ gridTemplateColumns: "1.5fr 1.2fr 80px 120px 100px 80px", display: "grid", padding: "12px 20px", gap: 12, alignItems: "center", cursor: "pointer" }}
                  onClick={() => setSelectedReceipt(r)}
                >
                  <span>
                    <span className="cell-th">{r.supplier?.name_th ?? "ไม่ระบุ"}</span>
                    <span className="cell-en">{r.description ?? r.supplier?.name_en ?? ""}</span>
                  </span>
                  <span>
                    <span className="cell-th" style={{ fontSize: 14 }}>{r.site?.name_th ?? "-"}</span>
                    <span className="cell-en">{r.site?.name_en ?? ""}</span>
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.category ?? "-"}</span>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>฿{formatCurrency(r.amount)}</span>
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
                <PendingQrMobile pendingQr={pendingQr} onApprove={handleApproveQr} />
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

      {giveCashDriver && (
        <GiveCashModal
          driver={giveCashDriver.driver}
          ownerId={ownerId}
          userId={userId}
          onClose={() => setGiveCashDriver(null)}
          onDone={() => {
            const driverName = giveCashDriver?.driver.name_th ?? "";
            setGiveCashDriver(null);
            showToast(`✓ มอบเงินให้ ${driverName} แล้ว`);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ReceiptStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; th: string }> = {
    pending:  { bg: "#FFF7ED", color: "#C2410C", th: "รอตรวจสอบ" },
    approved: { bg: "#FFFBEB", color: "#B45309", th: "อนุมัติแล้ว" },
    paid:     { bg: "#F0FDF4", color: "#15803D", th: "จ่ายแล้ว" },
    disputed: { bg: "#FEF2F2", color: "#B91C1C", th: "มีปัญหา" },
  };
  const c = config[status] ?? { bg: "#F3F4F6", color: "#6B7280", th: status };
  return (
    <span style={{ background: c.bg, color: c.color, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
      {c.th}
    </span>
  );
}

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
      <FormField label="หมายเหตุ Notes" value={notes} onChange={setNotes} placeholder="ค่าวัสดุสำหรับไซต์..." />
      <ModalActions onCancel={onClose} onSave={handleSave} saving={saving} saveLabel="มอบเงิน · Give cash" />
    </ModalWrapper>
  );
}

function DriverManagerMobile({ receipts, onAddReceipt, myBalance }: { receipts: ReceiptRow[]; onAddReceipt: () => void; myBalance: { totalGiven: number; totalSpent: number; balance: number } | null }) {
  const myReceipts = receipts.slice(0, 20);
  return (
    <div>
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>ใบเสร็จ</h1>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>Receipts · Driver Manager</p>
        </div>
      </div>

      <div style={{ padding: "16px 16px 12px" }}>
        {/* Cash balance card */}
        {myBalance !== null && (
          <div style={{
            background: myBalance.balance > 0 ? "linear-gradient(135deg, #1E3A8A, #3B82F6)" : "linear-gradient(135deg, #7f1d1d, #ef4444)",
            borderRadius: 14,
            padding: "16px 18px",
            color: "white",
            marginBottom: 16,
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

        {/* Primary action — big camera button */}
        <button
          onClick={onAddReceipt}
          style={{
            width: "100%",
            padding: "20px",
            borderRadius: 14,
            border: "none",
            background: "linear-gradient(135deg, var(--brand-primary), #7c3aed)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            cursor: "pointer",
            marginBottom: 20,
            boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
          }}
        >
          <Camera size={28} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>ถ่ายรูปใบเสร็จ</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Capture Receipt</div>
          </div>
        </button>

        {/* Recent submissions */}
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
          ใบเสร็จล่าสุด · Recent submissions
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {myReceipts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: 14 }}>
              ยังไม่มีใบเสร็จ · No receipts yet
            </div>
          ) : (
            myReceipts.map((r) => (
              <div key={r.id} style={{ background: "white", borderRadius: 10, padding: "14px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 15 }}>{r.supplier?.name_th ?? "ไม่ระบุ"}</strong>
                  <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
                    {r.site?.name_th ?? "-"} · {formatThaiDate(r.created_at)}
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

function PendingQrMobile({ pendingQr, onApprove }: { pendingQr: PendingQrReceipt[]; onApprove: (id: string) => void }) {
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
            <div key={r.id} style={{ background: "white", borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.description ?? "ไม่ระบุ"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {r.scanned_by_user?.name_th ?? "คนขับ"} · {r.site?.name_th ?? "-"}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#C2410C" }}>฿{formatCurrency(r.amount)}</div>
                <button
                  onClick={() => onApprove(r.id)}
                  style={{ marginTop: 4, background: "#15803D", color: "white", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  ชำระแล้ว
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileSuppliers({ suppliers, receipts, stats, tab, setTab, search, setSearch, onAddReceipt, onAddSupplier, onMarkPaid, onDispute }: any) {
  return (
    <div>
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>ซัพพลายเออร์</h1>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>Suppliers & Receipts</p>
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
                flexShrink: 0,
                padding: "6px 12px",
                borderRadius: 20,
                border: "1px solid var(--border)",
                background: tab === t.key ? "var(--brand-primary)" : "white",
                color: tab === t.key ? "white" : "var(--text-primary)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: tab === t.key ? 600 : 400,
              }}
            >
              {t.th}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {receipts.map((r: ReceiptRow) => (
            <div key={r.id} style={{ background: "white", borderRadius: 10, padding: "14px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong style={{ fontSize: 15 }}>{r.supplier?.name_th ?? "ไม่ระบุ"}</strong>
                  <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>{r.site?.name_th ?? "-"} · {formatThaiDate(r.created_at)}</small>
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
            <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: 14 }}>ไม่พบใบเสร็จ · No receipts</div>
          )}
        </div>
      </div>
    </div>
  );
}

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
      body: JSON.stringify({
        name_th: form.name_th,
        name_en: form.name_en,
        contact_phone: form.contact_phone || null,
        category: form.category || null,
      }),
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [form, setForm] = useState({
    supplier_id: suppliers[0]?.id ?? "",
    site_id: defaultSiteId ?? sites[0]?.id ?? "",
    amount: "",
    category: "",
    description: "",
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function startCamera() {
    setShowCamera(true);
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  }

  async function captureReceipt() {
    if (!videoRef.current) return;
    setCapturing(true);
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve as any, "image/jpeg", 0.85));
    const fileName = `receipts/${ownerId}/${Date.now()}.jpg`;
    const { data, error: uploadError } = await supabase.storage.from("receipt-photos").upload(fileName, blob, { contentType: "image/jpeg" });
    if (!uploadError && data) {
      const { data: urlData } = supabase.storage.from("receipt-photos").getPublicUrl(fileName);
      setPhotoUrl(urlData?.publicUrl ?? null);
    }
    setCapturing(false);
    stopCamera();
  }

  async function handleSave() {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { setError("กรอกยอดที่ถูกต้อง · Valid amount required"); return; }
    setSaving(true);
    const { data, error: dbError } = await supabase
      .from("receipts")
      .insert({
        owner_id: ownerId,
        submitted_by: userId,
        supplier_id: form.supplier_id || null,
        site_id: form.site_id || null,
        amount: amt,
        category: form.category || null,
        description: form.description || null,
        photo_url: photoUrl,
        status: "pending",
      })
      .select("*, site:site_id(id, name_th, name_en), supplier:supplier_id(id, name_th, name_en)")
      .single();
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    onAdded(data as ReceiptRow);
  }

  if (showCamera) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 9999, display: "flex", flexDirection: "column" }}>
        <div style={{ color: "white", padding: "20px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>ถ่ายรูปใบเสร็จ · Capture receipt</div>
        </div>
        <video ref={videoRef} autoPlay playsInline style={{ flex: 1, objectFit: "cover" }} />
        <div style={{ padding: "20px 16px", display: "flex", gap: 16 }}>
          <button onClick={stopCamera} className="btn-primary" style={{ flex: 1, justifyContent: "center", background: "rgba(255,255,255,0.15)" }}>
            ยกเลิก
          </button>
          <button onClick={captureReceipt} disabled={capturing} className="btn-primary" style={{ flex: 2, justifyContent: "center" }}>
            <Camera size={20} /> {capturing ? "กำลังบันทึก…" : "ถ่ายรูป"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <ModalWrapper title="เพิ่มใบเสร็จ" subtitle="Add receipt" onClose={onClose}>
      {error && <ErrorBox msg={error} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1/-1" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>ซัพพลายเออร์ Supplier</span>
          <select value={form.supplier_id} onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))} style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}>
            <option value="">ไม่ระบุ · None</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name_th}</option>)}
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

      {/* Photo */}
      <div style={{ marginTop: 4 }}>
        {photoUrl ? (
          <div style={{ position: "relative", display: "inline-block" }}>
            <img src={photoUrl} alt="receipt" style={{ width: "100%", maxWidth: 240, height: 160, objectFit: "cover", borderRadius: 8 }} />
            <button onClick={() => setPhotoUrl(null)} style={{ position: "absolute", top: 6, right: 6, background: "#EF4444", border: "none", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={14} color="white" />
            </button>
          </div>
        ) : (
          <button
            onClick={startCamera}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", border: "2px dashed var(--border)", borderRadius: 8, background: "transparent", cursor: "pointer", fontSize: 14, color: "var(--text-muted)" }}
          >
            <Camera size={20} />
            ถ่ายรูปใบเสร็จ · Take photo (optional)
          </button>
        )}
      </div>

      <ModalActions onCancel={onClose} onSave={handleSave} saving={saving} saveLabel="บันทึกใบเสร็จ · Save" />
    </ModalWrapper>
  );
}

// ── Shared modal helpers ──────────────────────────────────────────────────────

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
