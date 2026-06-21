"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState } from "react";
import { X, AlertTriangle, Check, Lock } from "lucide-react";

interface Props {
  entityType: string;
  entityId: string;
  fieldName: string;
  fieldLabelTh: string;
  fieldLabelEn: string;
  originalValue: string | number | null;
  originalDisplayTh: string;
  onClose: () => void;
  onSaved: (correctedValue: string, correctionId: string) => void;
  renderNewValueInput: (
    value: string,
    onChange: (v: string) => void
  ) => React.ReactNode;
}

export function CorrectionModal({
  entityType,
  entityId,
  fieldName,
  fieldLabelTh,
  fieldLabelEn,
  originalValue,
  originalDisplayTh,
  onClose,
  onSaved,
  renderNewValueInput,
}: Props) {
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [codeVisible, setCodeVisible] = useState(false);

  const canSave = newValue.trim() !== "" && reason.trim() !== "" && adminCode.trim() !== "";

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError("");

    const res = await fetch("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminCode,
        entityType,
        entityId,
        fieldName,
        originalValue: originalValue != null ? String(originalValue) : null,
        correctedValue: newValue.trim(),
        reason: reason.trim(),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(
        data.error === "Invalid admin code"
          ? "รหัสไม่ถูกต้อง · Invalid admin code"
          : data.error ?? "Error saving correction"
      );
      setSaving(false);
      return;
    }

    onSaved(newValue.trim(), data.id);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        background: "white", borderRadius: "20px 20px 0 0",
        width: "100%", maxWidth: 480,
        padding: "24px 20px 36px",
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>แก้ไขข้อมูล</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Edit · {fieldLabelEn}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >
            <X size={22} color="var(--text-muted)" />
          </button>
        </div>

        {/* Original value */}
        <div style={{
          background: "var(--surface)", borderRadius: 10, padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            ค่าเดิม · Original value
          </div>
          <div style={{ fontSize: 15, color: "var(--text-primary)" }}>
            {originalDisplayTh}
          </div>
        </div>

        {/* New value */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {fieldLabelTh} ใหม่ · New {fieldLabelEn}
          </label>
          {renderNewValueInput(newValue, setNewValue)}
        </div>

        {/* Reason — mandatory */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            เหตุผล · Reason <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ระบุเหตุผลที่แก้ไข · Explain why you are making this change"
            rows={3}
            style={{
              width: "100%", padding: "10px 12px",
              border: `1.5px solid ${reason.trim() ? "var(--border)" : "#EF4444"}`,
              borderRadius: 10, fontSize: 14, resize: "none",
              fontFamily: "inherit", color: "var(--text-primary)",
              background: "white", outline: "none",
              boxSizing: "border-box",
            }}
          />
          {!reason.trim() && (
            <div style={{ fontSize: 12, color: "#EF4444", display: "flex", alignItems: "center", gap: 4 }}>
              <AlertTriangle size={12} />
              บังคับกรอก · Required to save
            </div>
          )}
        </div>

        {/* Admin code */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
            <Lock size={13} />
            รหัสเจ้าของ · Owner code <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={codeVisible ? "text" : "password"}
              inputMode="numeric"
              value={adminCode}
              onChange={(e) => { setAdminCode(e.target.value); setError(""); }}
              placeholder="••••"
              style={{
                width: "100%", padding: "12px 44px 12px 14px",
                border: `1.5px solid ${error ? "#EF4444" : "var(--border)"}`,
                borderRadius: 10, fontSize: 18, letterSpacing: 6,
                fontFamily: "monospace", textAlign: "center",
                outline: "none", boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setCodeVisible((v) => !v)}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", fontSize: 12,
              }}
            >
              {codeVisible ? "ซ่อน" : "แสดง"}
            </button>
          </div>
          {error && (
            <div style={{ fontSize: 12, color: "#EF4444", display: "flex", alignItems: "center", gap: 4 }}>
              <AlertTriangle size={12} />
              {error}
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          style={{
            width: "100%", padding: "14px",
            background: canSave ? "#1E3A8A" : "var(--surface)",
            color: canSave ? "white" : "var(--text-muted)",
            border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background 0.2s",
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Check size={18} />
          {saving ? "กำลังบันทึก..." : "ยืนยันการแก้ไข · Confirm correction"}
        </button>

        {/* Warning */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 8,
          padding: "10px 12px", background: "#FFF7ED", borderRadius: 8,
          fontSize: 12, color: "#92400E",
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            การแก้ไขนี้จะถูกบันทึกพร้อมชื่อและเวลา ข้อมูลเดิมจะถูกเก็บไว้เสมอ
            <br />
            <span style={{ color: "#B45309" }}>
              This edit is logged with your name and timestamp. Original is always preserved.
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
