"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Owner triage modal: assign receipt from driver to supplier, create new supplier, or sort later.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Search, Check, Plus, Clock, Truck, ChevronRight } from "lucide-react";

type Supplier = { id: string; name_th: string; name_en: string; category: string | null };
type ReceiptRow = {
  id: string;
  amount: number;
  photo_url: string | null;
  description: string | null;
  ocr_supplier_hint?: string | null;
  site?: { id: string; name_th: string; name_en: string } | null;
};

interface Props {
  receipt: ReceiptRow;
  suppliers: Supplier[];
  ownerId: string;
  userId: string;
  onClose: () => void;
  onAssigned: (receiptId: string, supplierId: string, supplierName: string) => void;
  onSortLater: (receiptId: string) => void;
  onNewSupplier: () => void; // opens AddSupplierModal — parent handles it
}

export function ReceiptTriageModal({ receipt, suppliers, ownerId, userId, onClose, onAssigned, onSortLater, onNewSupplier }: Props) {
  const supabase = createClient();
  const [step, setStep] = useState<"choose" | "assign">("choose");
  const [search, setSearch] = useState(receipt.ocr_supplier_hint ?? receipt.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.name_th.toLowerCase().includes(q) || s.name_en.toLowerCase().includes(q) || (s.category ?? "").toLowerCase().includes(q);
  });

  async function handleAssign(supplier: Supplier) {
    setSaving(true);
    setError("");
    const { error: err } = await supabase
      .from("receipts")
      .update({ supplier_id: supplier.id, status: "pending", triaged_by: userId, triaged_at: new Date().toISOString() })
      .eq("id", receipt.id);
    setSaving(false);
    if (err) { setError(err.message); return; }

    // Update supplier ocr_fingerprints to remember this supplier for future matching
    if (receipt.ocr_supplier_hint) {
      const { data: existing } = await supabase
        .from("suppliers")
        .select("ocr_fingerprints")
        .eq("id", supplier.id)
        .single();
      const current = existing?.ocr_fingerprints ?? [];
      const hint = receipt.ocr_supplier_hint.trim().toLowerCase();
      if (!current.includes(hint)) {
        await supabase
          .from("suppliers")
          .update({ ocr_fingerprints: [...current, hint] })
          .eq("id", supplier.id);
      }
    }

    onAssigned(receipt.id, supplier.id, supplier.name_th);
  }

  async function handleSortLater() {
    setSaving(true);
    const { error: err } = await supabase
      .from("receipts")
      .update({ status: "pending_sorting" })
      .eq("id", receipt.id);
    setSaving(false);
    if (!err) onSortLater(receipt.id);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 560, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              {step === "choose" ? "ใบเสร็จใหม่จากนหน้าที่ · New receipt from driver" : "เลือกซัพพลายเออร์ · Select supplier"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {receipt.site?.name_th} · ฿{receipt.amount?.toLocaleString()}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={22} color="var(--text-muted)" />
          </button>
        </div>

        {step === "choose" ? (
          <>
            {/* Receipt preview */}
            {receipt.photo_url && (
              <div style={{ padding: "12px 20px 0" }}>
                <img
                  src={receipt.photo_url}
                  alt="receipt"
                  style={{ width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 10, border: "1px solid var(--border)", background: "#F9FAFB" }}
                />
                {receipt.ocr_supplier_hint && (
                  <div style={{ marginTop: 8, background: "#EFF6FF", borderRadius: 8, padding: "7px 12px", fontSize: 13, color: "#1E40AF" }}>
                    🔍 <strong>AI:</strong> {receipt.ocr_supplier_hint}
                    {receipt.amount ? ` · ฿${receipt.amount.toLocaleString()}` : ""}
                  </div>
                )}
              </div>
            )}

            {/* Three choices */}
            <div style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={() => setStep("assign")}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", background: "#EFF6FF", borderRadius: 12, border: "2px solid #BFDBFE", cursor: "pointer" }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#1E3A8A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Truck size={22} color="white" />
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1E3A8A" }}>มีซัพพลายเออร์แล้ว</div>
                  <div style={{ fontSize: 13, color: "#4B5563" }}>Assign to existing supplier</div>
                </div>
                <ChevronRight size={18} color="#1E3A8A" />
              </button>

              <button
                onClick={() => { onNewSupplier(); onClose(); }}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", background: "#FFF7ED", borderRadius: 12, border: "2px solid #FED7AA", cursor: "pointer" }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FF6A00", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Plus size={22} color="white" />
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#C2410C" }}>ซัพพลายเออร์ใหม่</div>
                  <div style={{ fontSize: 13, color: "#4B5563" }}>Open new supplier</div>
                </div>
                <ChevronRight size={18} color="#C2410C" />
              </button>

              <button
                onClick={handleSortLater}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", background: "#F9FAFB", borderRadius: 12, border: "2px solid #E5E7EB", cursor: "pointer" }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Clock size={22} color="white" />
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#374151" }}>จัดการทีหลัง</div>
                  <div style={{ fontSize: 13, color: "#6B7280" }}>Sort later · will appear in dashboard</div>
                </div>
              </button>

              {error && <div style={{ color: "#EF4444", fontSize: 13, textAlign: "center" }}>{error}</div>}
            </div>
          </>
        ) : (
          <>
            {/* Assign step */}
            <div style={{ padding: "12px 20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, background: "#F9FAFB", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px" }}>
                <Search size={18} color="var(--text-muted)" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาซัพพลายเออร์ · Search supplier"
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15 }}
                />
              </label>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                  ไม่พบซัพพลายเออร์ · No match
                </div>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleAssign(s)}
                    disabled={saving}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "14px 12px", background: "none", border: "none",
                      borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Truck size={18} color="#1E3A8A" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{s.name_th}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.name_en} {s.category ? `· ${s.category}` : ""}</div>
                    </div>
                    <Check size={18} color="#22C55E" />
                  </button>
                ))
              )}
            </div>

            <div style={{ padding: "10px 20px 24px" }}>
              <button
                onClick={() => setStep("choose")}
                style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid var(--border)", background: "white", cursor: "pointer", fontSize: 14, color: "var(--text-muted)" }}
              >
                ← กลับ · Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
