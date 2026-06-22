"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Monthly report — Driver cash float section. Per driver manager: total cash
// received this month + number of handovers. (Cash "spent"/differences depends
// on the receipt cash-payment flag and is tracked separately.)

import { useMemo } from "react";
import { Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface CashEntry {
  driverId: string;
  amount: number | null;
  driver: { name_th: string; name_en: string } | null;
}

export function MonthlyDriverCash({ entries }: { entries: CashEntry[] }) {
  const { drivers, total } = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    let total = 0;
    for (const e of entries) {
      const amt = e.amount ?? 0;
      total += amt;
      const entry = map.get(e.driverId) ?? { name: e.driver?.name_th ?? "—", total: 0, count: 0 };
      entry.total += amt;
      entry.count += 1;
      map.set(e.driverId, entry);
    }
    return {
      drivers: Array.from(map.values()).sort((a, b) => b.total - a.total),
      total,
    };
  }, [entries]);

  if (drivers.length === 0) return null;

  return (
    <section style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Wallet size={18} color="#1E3A8A" />
        <h2 style={{ fontSize: 17, fontWeight: 800 }}>
          เงินสดคนขับ <small style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Driver cash · ฿{formatCurrency(total)}</small>
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {drivers.map((d) => (
          <div
            key={d.name}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "white", border: "1px solid var(--border, #E5E7EB)", borderRadius: 12, padding: "11px 14px",
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{d.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.count} ครั้ง · handovers</div>
            </div>
            <strong style={{ fontSize: 15 }}>฿{formatCurrency(d.total)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
