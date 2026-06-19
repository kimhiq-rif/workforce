"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Check, Banknote, Receipt, Users } from "lucide-react";
import { formatCurrency, formatThaiDate } from "@/lib/format";

interface FinanceClientProps {
  todayAttendance: any[];
  pendingReceipts: any[];
  pendingAdvances: any[];
  weeklyWages: any[];
  ownerId: string;
  today: string;
}

export function FinanceClient({ todayAttendance, pendingReceipts: initReceipts, pendingAdvances: initAdvances, weeklyWages, ownerId, today }: FinanceClientProps) {
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
                    <div className="avatar" style={{ width: 34, height: 34, fontSize: 11, flexShrink: 0 }}>
                      {a.worker?.name_th?.[0] ?? "?"}
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
          />
        </div>

        {toast && <div className="toast">{toast}</div>}
      </DashboardShell>
    </>
  );
}

function MobileFinance({ todayWageTotal, pendingReceiptTotal, pendingAdvanceTotal, pendingReceipts, pendingAdvances, today, onPayReceipt, onPayAdvance }: any) {
  return (
    <div>
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>การเงิน</h1>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>Finance · {formatThaiDate(today)}</p>
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <div className="mini-stat"><strong>฿{formatCurrency(todayWageTotal)}</strong><span>ค่าแรง</span><small>Wages</small></div>
          <div className="mini-stat"><strong style={{ color: "#F97316" }}>฿{formatCurrency(pendingReceiptTotal)}</strong><span>ใบเสร็จ</span><small>Receipts</small></div>
          <div className="mini-stat"><strong style={{ color: "#F59E0B" }}>฿{formatCurrency(pendingAdvanceTotal)}</strong><span>เบิกค้าง</span><small>Advances</small></div>
        </div>

        {pendingReceipts.length > 0 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>ใบเสร็จรอชำระ <small style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>Pending receipts</small></div>
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
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>เบิกค้างจ่าย <small style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>Pending advances</small></div>
            {pendingAdvances.slice(0, 5).map((a: any) => (
              <div key={a.id} style={{ background: "white", borderRadius: 8, padding: "12px 14px", marginBottom: 6, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <div className="avatar" style={{ width: 32, height: 32, fontSize: 11, flexShrink: 0 }}>{a.worker?.name_th?.[0] ?? "?"}</div>
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
