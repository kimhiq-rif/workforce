"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Wallet, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface CashEntry {
  id: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

interface CashReceipt {
  id: string;
  amount: number;
  supplier: { name_th: string } | null;
}

interface DriverCashData {
  totalGiven: number;
  totalSpent: number;
  balance: number;
  entries: CashEntry[];
  cashReceipts: CashReceipt[];
}

interface DriverCashPanelProps {
  driverId: string;
  driverName: string;
  date: string;
  isOwner: boolean;
}

export function DriverCashPanel({ driverId, driverName, date, isOwner }: DriverCashPanelProps) {
  const [data, setData] = useState<DriverCashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showAddCash, setShowAddCash] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/driver-cash?driverId=${driverId}&date=${date}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [driverId, date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAddCash() {
    setError("");
    const amt = parseFloat(addAmount);
    if (!amt || amt <= 0) { setError("กรุณากรอกจำนวนเงิน · Enter amount"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/driver-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId, amount: amt, date, notes: addNotes || null }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "เกิดข้อผิดพลาด"); return; }
      setAddAmount("");
      setAddNotes("");
      setShowAddCash(false);
      await fetchData();
    } finally {
      setSaving(false);
    }
  }

  const balanceColor = !data ? "var(--text-muted)"
    : data.balance > 0 ? "#16A34A"
    : data.balance === 0 ? "var(--text-muted)"
    : "#DC2626";

  return (
    <div style={{
      background: "white",
      border: "1px solid var(--border)",
      borderRadius: 14,
      overflow: "hidden",
    }}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ background: "#FFF7ED", borderRadius: 8, padding: 7 }}>
          <Wallet size={20} color="#EA580C" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>เงินสดนหน้างาน · Driver cash</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{driverName} · {date}</div>
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>...</div>
        ) : (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: balanceColor }}>
              ฿{formatCurrency(data?.balance ?? 0)}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>คงเหลือ · Balance</div>
          </div>
        )}
        {expanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
      </div>

      {/* Expanded detail */}
      {expanded && data && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {/* Summary row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 1,
            background: "var(--border)",
          }}>
            {[
              { label: "รับมา · Given", value: data.totalGiven, color: "#16A34A" },
              { label: "ใช้แล้ว · Spent", value: data.totalSpent, color: "#DC2626" },
              { label: "คงเหลือ · Left", value: data.balance, color: balanceColor },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "white", padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 17, fontWeight: 700, color }}>฿{formatCurrency(value)}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Cash entries given by owner */}
          {data.entries.length > 0 && (
            <div style={{ padding: "10px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                เงินที่รับ · Cash received
              </div>
              {data.entries.map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span style={{ color: "var(--text-muted)" }}>
                    {new Date(e.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}
                    {e.notes ? ` · ${e.notes}` : ""}
                  </span>
                  <strong style={{ color: "#16A34A" }}>+฿{formatCurrency(e.amount)}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Cash receipts spent */}
          {data.cashReceipts.length > 0 && (
            <div style={{ padding: "10px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                ใบเสร็จที่จ่าย · Receipts paid
              </div>
              {data.cashReceipts.map((r) => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span>{r.supplier?.name_th ?? "ไม่ระบุ ·  Unknown"}</span>
                  <strong style={{ color: "#DC2626" }}>-฿{formatCurrency(r.amount)}</strong>
                </div>
              ))}
            </div>
          )}

          {data.entries.length === 0 && data.cashReceipts.length === 0 && (
            <div style={{ padding: "16px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
              ยังไม่มีรายการวันนี้ · No entries today
            </div>
          )}

          {/* Add cash button — owner only */}
          {isOwner && (
            <div style={{ padding: "10px 16px 14px" }}>
              {!showAddCash ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAddCash(true); }}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "2px dashed #EA580C",
                    borderRadius: 10,
                    background: "#FFF7ED",
                    color: "#EA580C",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Plus size={18} />
                  เติมเงินสด · Add cash to driver
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    min="1"
                    placeholder="จำนวนเงิน · Amount (฿)"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "2px solid var(--brand-primary)",
                      borderRadius: 8,
                      fontSize: 18,
                      fontWeight: 700,
                      outline: "none",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="หมายเหตุ · Notes (optional)"
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  {error && <div style={{ color: "#DC2626", fontSize: 12 }}>{error}</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => { setShowAddCash(false); setAddAmount(""); setAddNotes(""); setError(""); }}
                      style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid var(--border)", background: "white", fontSize: 14, cursor: "pointer" }}
                    >
                      ยกเลิก · Cancel
                    </button>
                    <button
                      onClick={handleAddCash}
                      disabled={saving}
                      style={{ flex: 2, padding: "9px", borderRadius: 8, border: "none", background: "#EA580C", color: "white", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}
                    >
                      {saving ? "กำลังบันทึก…" : "ยืนยัน · Confirm"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
