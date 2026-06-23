"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Monthly report — Needs Attention panel (per spec): critical items only.
// Currently surfaces the two items whose data model is unambiguous:
//   - overdue projects (current stage target_end_date < today)
//   - pending receipts (not approved/paid/disputed), with total amount
// TODO (data model pending): cash differences, edited entries, overtime missing cost.

import Link from "next/link";
import { AlertTriangle, Clock, Receipt, Wallet, Pencil, Timer } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export interface OverdueProject {
  siteId: string;
  siteName: string;
  targetDate: string;
  daysOverdue: number;
}

interface PendingReceipt {
  status: string;
  amount: number | null;
}

export interface CashDifference {
  name: string;
  given: number;
  used: number;
}

const PENDING = new Set(["pending_qr", "pending", "pending_sorting", "paid_pending_sorting"]);

export function MonthlyNeedsAttention({
  overdueProjects,
  receipts,
  cashDifferences = [],
  editedCount = 0,
  overtimeMissingCost = 0,
  targetMonth,
}: {
  overdueProjects: OverdueProject[];
  receipts: PendingReceipt[];
  cashDifferences?: CashDifference[];
  editedCount?: number;
  overtimeMissingCost?: number;
  targetMonth?: string;
}) {
  const pending = receipts.filter((r) => PENDING.has(r.status));
  const pendingTotal = pending.reduce((s, r) => s + (r.amount ?? 0), 0);

  const items: { key: string; icon: React.ReactNode; title: string; detail: string; href: string; severity: number }[] = [];

  for (const p of [...overdueProjects].sort((a, b) => b.daysOverdue - a.daysOverdue)) {
    items.push({
      key: `overdue-${p.siteId}`,
      icon: <Clock size={16} color="#B91C1C" />,
      title: `${p.siteName} — เกินกำหนดขั้น ${p.daysOverdue} วัน`,
      detail: `Stage overdue · target ${p.targetDate}`,
      href: `/sites/${p.siteId}`,
      severity: 1000 + p.daysOverdue, // overdue projects rank above receipts
    });
  }

  if (pending.length > 0) {
    items.push({
      key: "pending-receipts",
      icon: <Receipt size={16} color="#B45309" />,
      title: `${pending.length} ใบเสร็จรอจัดการ · Pending receipts`,
      detail: `฿${formatCurrency(pendingTotal)} รอการอนุมัติ/จัดประเภท`,
      href: "/suppliers",
      severity: pendingTotal,
    });
  }

  for (const c of cashDifferences) {
    items.push({
      key: `cash-${c.name}`,
      icon: <Wallet size={16} color="#B91C1C" />,
      title: `${c.name} — เงินสดติดลบ · Cash overspent`,
      detail: `ใช้ ฿${formatCurrency(c.used)} / รับ ฿${formatCurrency(c.given)} (ขาด ฿${formatCurrency(c.used - c.given)})`,
      href: "/suppliers",
      severity: 2000 + (c.used - c.given), // cash anomalies rank highest
    });
  }

  if (overtimeMissingCost > 0) {
    items.push({
      key: "overtime-missing",
      icon: <Timer size={16} color="#B45309" />,
      title: `${overtimeMissingCost} รายการ OT ไม่มีค่าจ้าง · Overtime missing cost`,
      detail: "กรอกค่าล่วงเวลาที่ค้างอยู่",
      href: targetMonth ? `/reports/monthly/overtime?month=${targetMonth}` : "/reports/monthly/overtime",
      severity: 1500,
    });
  }

  if (editedCount > 0) {
    items.push({
      key: "edited-entries",
      icon: <Pencil size={16} color="#7C3AED" />,
      title: `${editedCount} รายการถูกแก้ไข · Edited entries`,
      detail: "มีการแก้ไขย้อนหลังในเดือนนี้",
      href: "/reports/monthly",
      severity: 1, // informational — lowest
    });
  }

  if (items.length === 0) {
    return (
      <section
        style={{
          background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 12,
          padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "#166534" }}>
          ✓ ไม่มีรายการเร่งด่วน · Nothing needs attention
        </span>
      </section>
    );
  }

  items.sort((a, b) => b.severity - a.severity);

  return (
    <section style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <AlertTriangle size={18} color="#DC2626" />
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#991B1B" }}>
          ต้องดำเนินการ <small style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Needs attention · {items.length}</small>
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10,
              padding: "11px 13px", textDecoration: "none",
            }}
          >
            <div style={{ flexShrink: 0 }}>{it.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#7F1D1D" }}>{it.title}</div>
              <div style={{ fontSize: 12, color: "#B91C1C" }}>{it.detail}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
