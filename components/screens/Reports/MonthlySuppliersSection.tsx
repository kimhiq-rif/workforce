"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Monthly report — Suppliers section (per spec): only suppliers with transactions
// this month. Per supplier: total amount, related sites by %, and
// approved / pending / problem receipt counts (expandable). Severity-first
// (highest total first).

import { useMemo, useState } from "react";
import { ChevronDown, Package } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface MonthReceipt {
  site_id: string | null;
  supplier_id: string | null;
  amount: number | null;
  status: string;
  supplier: { name_th: string; name_en: string } | null;
}

interface SiteRef {
  id: string;
  name_th: string;
  name_en: string;
}

// approved = approved/paid, problem = disputed, pending = everything else.
function bucket(status: string): "approved" | "pending" | "problem" {
  if (status === "approved" || status === "paid") return "approved";
  if (status === "disputed") return "problem";
  return "pending";
}

export function MonthlySuppliersSection({
  receipts,
  sites,
}: {
  receipts: MonthReceipt[];
  sites: SiteRef[];
}) {
  const [open, setOpen] = useState<string | null>(null);

  const suppliers = useMemo(() => {
    const siteName = new Map(sites.map((s) => [s.id, s.name_th]));
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        total: number;
        bySite: Map<string, number>;
        approved: number;
        pending: number;
        problem: number;
      }
    >();

    for (const r of receipts) {
      if (!r.supplier_id) continue; // only sorted receipts with a supplier
      const entry =
        map.get(r.supplier_id) ?? {
          id: r.supplier_id,
          name: r.supplier?.name_th ?? "ไม่ทราบซัพพลายเออร์",
          total: 0,
          bySite: new Map<string, number>(),
          approved: 0,
          pending: 0,
          problem: 0,
        };
      const amt = r.amount ?? 0;
      entry.total += amt;
      if (r.site_id) entry.bySite.set(r.site_id, (entry.bySite.get(r.site_id) ?? 0) + amt);
      entry[bucket(r.status)] += 1;
      map.set(r.supplier_id, entry);
    }

    return Array.from(map.values())
      .map((s) => ({
        ...s,
        sites: Array.from(s.bySite.entries())
          .map(([id, amt]) => ({
            id,
            name: siteName.get(id) ?? "—",
            amount: amt,
            pct: s.total > 0 ? Math.round((amt / s.total) * 100) : 0,
          }))
          .sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.total - a.total); // severity-first
  }, [receipts, sites]);

  if (suppliers.length === 0) return null;

  return (
    <section style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Package size={18} color="#1E3A8A" />
        <h2 style={{ fontSize: 17, fontWeight: 800 }}>
          ซัพพลายเออร์ <small style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Suppliers · {suppliers.length}</small>
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {suppliers.map((s) => {
          const isOpen = open === s.id;
          return (
            <div key={s.id} style={{ border: "1px solid var(--border, #E5E7EB)", borderRadius: 12, overflow: "hidden", background: "white" }}>
              <button
                onClick={() => setOpen(isOpen ? null : s.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 10, padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{s.name}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 11 }}>
                    <span style={{ color: "#166534" }}>✓ {s.approved}</span>
                    <span style={{ color: "#B45309" }}>⏳ {s.pending}</span>
                    {s.problem > 0 && <span style={{ color: "#B91C1C" }}>⚠ {s.problem}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <strong style={{ fontSize: 15 }}>฿{formatCurrency(s.total)}</strong>
                  <ChevronDown size={16} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: "0 14px 12px", borderTop: "1px solid #F3F4F6" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", margin: "10px 0 6px" }}>
                    อัตราส่วนตามไซต์ · Related sites by %
                  </div>
                  {s.sites.map((site) => (
                    <div key={site.id} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                        <span>{site.name}</span>
                        <span style={{ color: "var(--text-muted)" }}>฿{formatCurrency(site.amount)} · {site.pct}%</span>
                      </div>
                      <div style={{ height: 5, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${site.pct}%`, height: "100%", background: "#1E3A8A" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
