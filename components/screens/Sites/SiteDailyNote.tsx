"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Owner leaves a daily note on a site; it's pushed to the field manager(s) who
// reported attendance there today and shown here. Self-expires at midnight.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StickyNote, X, Pencil, Send } from "lucide-react";

export function SiteDailyNote({
  siteId,
  initialNote,
  canEdit,
}: {
  siteId: string;
  initialNote: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasNote = !!(initialNote && initialNote.trim());

  // Non-owner with no note: render nothing.
  if (!canEdit && !hasNote) return null;

  async function save() {
    if (!note.trim()) return;
    setBusy(true);
    const res = await fetch("/api/site-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: siteId, note: note.trim() }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function clear() {
    setBusy(true);
    await fetch("/api/site-note", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: siteId }),
    }).catch(() => null);
    setBusy(false);
    setNote("");
    setEditing(false);
    router.refresh();
  }

  const card: React.CSSProperties = {
    margin: "12px 16px",
    background: "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)",
    border: "1px solid #FED7AA",
    borderRadius: 12,
    padding: "12px 14px",
  };

  // Editing form (owner only)
  if (editing) {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <StickyNote size={16} color="#EA580C" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#9A3412" }}>
            หมายเหตุประจำวัน · Daily note
          </span>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          autoFocus
          placeholder="ข้อความถึงผู้จัดการที่ไซต์ · Message to the site manager"
          style={{
            width: "100%", resize: "vertical", borderRadius: 8,
            border: "1px solid #FDBA74", padding: "8px 10px", fontSize: 14,
            background: "white", color: "#1f2937", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={save}
            disabled={busy || !note.trim()}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "#EA580C", color: "white", border: "none",
              borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700,
              cursor: busy || !note.trim() ? "default" : "pointer",
              opacity: busy || !note.trim() ? 0.6 : 1,
            }}
          >
            <Send size={13} /> {busy ? "..." : "ส่ง · Send"}
          </button>
          <button
            onClick={() => { setNote(initialNote ?? ""); setEditing(false); }}
            style={{
              background: "transparent", border: "1px solid #FDBA74",
              borderRadius: 8, padding: "7px 12px", fontSize: 13, color: "#9A3412",
              cursor: "pointer",
            }}
          >
            ยกเลิก · Cancel
          </button>
        </div>
      </div>
    );
  }

  // Owner, no note yet: compact "add note" trigger.
  if (canEdit && !hasNote) {
    return (
      <div style={{ margin: "12px 16px" }}>
        <button
          onClick={() => setEditing(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: "1px dashed #FDBA74",
            borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#9A3412",
            cursor: "pointer", width: "100%",
          }}
        >
          <StickyNote size={15} color="#EA580C" />
          เพิ่มหมายเหตุถึงผู้จัดการ · Add note to site manager
        </button>
      </div>
    );
  }

  // Display the existing note.
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <StickyNote size={18} color="#EA580C" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9A3412", marginBottom: 2 }}>
            หมายเหตุประจำวัน · Daily note
          </div>
          <div style={{ fontSize: 14, color: "#7C2D12", lineHeight: 1.45, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
            {initialNote}
          </div>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => setEditing(true)}
              title="Edit"
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "#9A3412" }}
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={clear}
              disabled={busy}
              title="Clear"
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: "#9A3412" }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
