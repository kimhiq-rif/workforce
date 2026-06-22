"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Shows the current stage's target date (countdown / overdue), or — when no
// target is set — an owner-only inline control to set one, and a muted notice
// for non-owners. Used on both desktop and mobile site detail.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, AlertTriangle } from "lucide-react";

interface CurrentStage {
  name_en: string;
  name_th: string;
  color: string;
  target_end_date: string | null;
}

export function StageTargetBadge({
  siteId,
  stage,
  canEdit,
}: {
  siteId: string;
  stage: CurrentStage | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  if (!stage) return null;

  async function save() {
    if (!date) return;
    setBusy(true);
    const res = await fetch(`/api/sites/${siteId}/stage-target`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_end_date: date }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  // Target already set → countdown / overdue badge.
  if (stage.target_end_date) {
    const diffDays = Math.ceil(
      (new Date(stage.target_end_date).getTime() - Date.now()) / 86_400_000
    );
    const overdue = diffDays < 0;
    return (
      <div
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4,
          background: overdue ? "#FEF2F2" : "#F0FDF4",
          border: `1px solid ${overdue ? "#FECACA" : "#86EFAC"}`,
          borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600,
          color: overdue ? "#B91C1C" : "#166534",
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: stage.color }} />
        {stage.name_en} · {overdue
          ? `Stage overdue ${Math.abs(diffDays)} days`
          : `Stage target: ${diffDays} days remaining`}
      </div>
    );
  }

  // No target, owner editing → inline date picker.
  if (editing) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          autoFocus
          style={{ border: "1px solid #FDBA74", borderRadius: 8, padding: "4px 8px", fontSize: 13 }}
        />
        <button
          onClick={save}
          disabled={busy || !date}
          style={{
            background: "#EA580C", color: "white", border: "none", borderRadius: 8,
            padding: "5px 12px", fontSize: 12, fontWeight: 700,
            cursor: busy || !date ? "default" : "pointer", opacity: busy || !date ? 0.6 : 1,
          }}
        >
          {busy ? "..." : "บันทึก · Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          style={{ background: "transparent", border: "none", fontSize: 12, color: "#9A3412", cursor: "pointer" }}
        >
          ยกเลิก
        </button>
      </div>
    );
  }

  // No target — owner gets a set button, others a muted notice.
  if (canEdit) {
    return (
      <button
        onClick={() => setEditing(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4,
          background: "#FFF7ED", border: "1px dashed #FDBA74", borderRadius: 20,
          padding: "3px 12px", fontSize: 12, fontWeight: 700, color: "#9A3412", cursor: "pointer",
        }}
      >
        <Flag size={12} />
        {stage.name_en} · ตั้งเป้าหมายขั้น · Set stage target
      </button>
    );
  }

  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4,
        background: "#FEF9C3", border: "1px solid #FDE68A", borderRadius: 20,
        padding: "3px 10px", fontSize: 12, fontWeight: 600, color: "#92400E",
      }}
    >
      <AlertTriangle size={12} />
      {stage.name_en} · ยังไม่ได้ตั้งเป้าหมาย · No target set
    </div>
  );
}
