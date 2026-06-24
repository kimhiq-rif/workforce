"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { X } from "lucide-react";

interface ConfirmModalProps {
  title: string;
  titleEn?: string;
  message: string;
  confirmLabel?: string;
  confirmLabelEn?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  titleEn,
  message,
  confirmLabel = "ยืนยัน",
  confirmLabelEn = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "white", borderRadius: 16,
          padding: "28px 24px", width: "100%", maxWidth: 380,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: "#0E1B3C", margin: 0 }}>{title}</h2>
            {titleEn && <small style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}>{titleEn}</small>}
          </div>
          <button
            onClick={onCancel}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 22 }}>{message}</p>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "11px",
              border: "1px solid var(--border)", borderRadius: 10,
              background: "white", cursor: "pointer", fontSize: 14,
              color: "var(--text-primary)",
            }}
          >
            ยกเลิก · Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 2, padding: "11px", border: "none", borderRadius: 10,
              background: danger ? "#B91C1C" : "#0E1B3C",
              color: "white", cursor: "pointer", fontSize: 14, fontWeight: 700,
            }}
          >
            {confirmLabel}
            {confirmLabelEn && <small style={{ display: "block", fontSize: 11, fontWeight: 400, opacity: 0.8 }}>{confirmLabelEn}</small>}
          </button>
        </div>
      </div>
    </div>
  );
}
