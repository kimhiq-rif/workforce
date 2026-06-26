"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { UserPlus, Trash2, X, Eye, EyeOff, Shield, Truck, Check } from "lucide-react";
import { formatThaiDate } from "@/lib/format";

type Member = {
  id: string;
  auth_id: string | null;
  role: "field_manager" | "technical_admin";
  name_th: string;
  name_en: string;
  phone: string | null;
  created_at: string;
};

const ROLE_META = {
  field_manager: {
    th: "ผู้จัดการหน้างาน",
    en: "Field Manager",
    desc: "Attendance check-in, site photo, rain reporting",
    color: "#2563EB",
    bg: "#EFF6FF",
    icon: Shield,
  },
  technical_admin: {
    th: "ผู้จัดการขนส่ง",
    en: "Driver Manager",
    desc: "All Field Manager permissions + receipt upload + QR payments",
    color: "#7C3AED",
    bg: "#F5F3FF",
    icon: Truck,
  },
};

const ROLES = [
  {
    value: "field_manager" as const,
    en: "Field Manager",
    th: "ผู้จัดการหน้างาน",
    desc: "Attendance check-in · site photo · rain reporting",
  },
  {
    value: "technical_admin" as const,
    en: "Driver Manager",
    th: "ผู้จัดการขนส่ง",
    desc: "All Field Manager access + receipt upload + QR supplier payments",
  },
];

interface TeamClientProps {
  members: Member[];
  ownerName: string;
}

export function TeamClient({ members: initialMembers, ownerName }: TeamClientProps) {
  const [members, setMembers] = useState(initialMembers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Member | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  function handleDelete(member: Member) {
    setConfirmDelete(member);
  }

  async function doDelete(member: Member) {
    setConfirmDelete(null);
    const res = await fetch("/api/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id }),
    });

    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      showToast(`${member.name_th} removed from team`);
    } else {
      const j = await res.json().catch(() => ({}));
      showToast("Error: " + (j.error ?? "Unknown error"));
    }
  }

  return (
    <>
      <DashboardShell>
        <div className="desktop-only">
          <div className="content-header">
            <div>
              <h1>ทีมงาน</h1>
              <p>Team Management · สมาชิกในระบบ</p>
            </div>
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>
              <UserPlus size={18} />
              เพิ่มสมาชิก
              <small>Add member</small>
            </button>
          </div>

          {/* Owner row */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              เจ้าของ · Owner
            </div>
            <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div className="avatar" style={{ width: 44, height: 44, fontSize: 16, background: "var(--brand-primary)", color: "white", flexShrink: 0 }}>
                {ownerName[0]}
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 16 }}>{ownerName}</strong>
                <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>Owner · เจ้าของ · Full access</small>
              </div>
              <span style={{ background: "#FFF7ED", color: "#C2410C", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                Owner
              </span>
            </div>
          </div>

          {/* Team members */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              ทีมงาน · {members.length} members
            </div>

            {members.length === 0 ? (
              <div style={{ background: "white", border: "2px dashed var(--border)", borderRadius: 12, padding: "40px 20px", textAlign: "center" }}>
                <UserPlus size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}><span className="th-text">ยังไม่มีทีมงาน</span><span className="en-text">No team members yet</span></div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}><span className="th-text">เพิ่มผู้จัดการหน้างานหรือผู้จัดการขนส่ง</span><span className="en-text">Add a Field Manager or Driver Manager to get started</span></div>
                <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                  <UserPlus size={16} /> <span className="th-text">เพิ่มสมาชิกคนแรก</span><span className="en-text">Add first member</span>
                </button>
              </div>
            ) : (
              <div className="table-card">
                {members.map((m) => {
                  const meta = ROLE_META[m.role];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={m.id}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid var(--border)" }}
                    >
                      <div className="avatar" style={{ width: 40, height: 40, fontSize: 14, background: meta.bg, color: meta.color, flexShrink: 0 }}>
                        <Icon size={18} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: 15 }}>{m.name_th}</strong>
                        <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>
                          {m.name_en}{m.phone ? ` · ${m.phone}` : ""} · {formatThaiDate(m.created_at)}
                        </small>
                      </div>
                      <span style={{ background: meta.bg, color: meta.color, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        {meta.en}
                      </span>
                      <button
                        onClick={() => handleDelete(m)}
                        title="Remove from team"
                        style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", cursor: "pointer", color: "#B91C1C", display: "flex", alignItems: "center", minHeight: 44, minWidth: 44, justifyContent: "center" }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Mobile */}
        <div className="mobile-only">
          <MobileTeam
            ownerName={ownerName}
            members={members}
            onAdd={() => setShowAddModal(true)}
            onDelete={handleDelete}
          />
        </div>

        {toast && <div className="toast">{toast}</div>}
      </DashboardShell>

      {confirmDelete && (
        <ConfirmModal
          title="ลบสมาชิก"
          titleEn="Remove team member"
          message={`${confirmDelete.name_th} (${confirmDelete.name_en}) จะไม่สามารถเข้าสู่ระบบได้อีก · They will no longer be able to log in.`}
          confirmLabel="ลบออก"
          confirmLabelEn="Remove"
          danger
          onConfirm={() => doDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onAdded={(m) => {
            setMembers((prev) => [...prev, m]);
            setShowAddModal(false);
            showToast(`✓ ${m.name_th} added to team`);
          }}
        />
      )}
    </>
  );
}

function MobileTeam({ ownerName, members, onAdd, onDelete }: {
  ownerName: string;
  members: Member[];
  onAdd: () => void;
  onDelete: (m: Member) => void;
}) {
  return (
    <div>
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>
            <span className="th-text">ทีมงาน</span>
            <span className="en-text">Team</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>
            <span className="th-text">{members.length} คน</span>
            <span className="en-text">{members.length} members</span>
          </p>
        </div>
        <button
          onClick={onAdd}
          className="mobile-topbar-action" style={{ gap: 6 }}
        >
          <UserPlus size={16} />
          <span className="th-text">เพิ่ม</span>
          <span className="en-text">Add</span>
        </button>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Owner */}
        <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--border)" }}>
          <div className="avatar" style={{ width: 36, height: 36, fontSize: 13, background: "var(--brand-primary)", color: "white", flexShrink: 0 }}>{ownerName[0]}</div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 14 }}>{ownerName}</strong>
            <small style={{ display: "block", color: "var(--text-muted)", fontSize: 11 }}>
              <span className="th-text">เจ้าของ</span>
              <span className="en-text">Owner</span>
            </small>
          </div>
          <span style={{ background: "#FFF7ED", color: "#C2410C", padding: "3px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
            <span className="th-text">เจ้าของ</span>
            <span className="en-text">Owner</span>
          </span>
        </div>

        {members.map((m) => {
          const meta = ROLE_META[m.role];
          const Icon = meta.icon;
          return (
            <div key={m.id} style={{ background: "white", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--border)" }}>
              <div className="avatar" style={{ width: 36, height: 36, fontSize: 13, background: meta.bg, color: meta.color, flexShrink: 0 }}>
                <Icon size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 14 }}>{m.name_th}</strong>
                <small style={{ display: "block", color: "var(--text-muted)", fontSize: 11 }}>{meta.en} · {meta.th}</small>
              </div>
              <button
                onClick={() => onDelete(m)}
                style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "10px 12px", cursor: "pointer", color: "#B91C1C", display: "flex", minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}

        {members.length === 0 && (
          <div style={{ background: "white", borderRadius: 10, padding: "28px 16px", textAlign: "center", border: "2px dashed var(--border)" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 12 }}><span className="th-text">ยังไม่มีทีมงาน</span><span className="en-text">No team members yet</span></div>
            <button className="btn-primary" onClick={onAdd} style={{ justifyContent: "center" }}>
              <UserPlus size={16} /> <span className="th-text">เพิ่มสมาชิกคนแรก</span><span className="en-text">Add first member</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddMemberModal({ onClose, onAdded }: {
  onClose: () => void;
  onAdded: (m: Member) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [nameTh, setNameTh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"field_manager" | "technical_admin">("field_manager");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!email.trim() || !password || !nameTh.trim()) {
      setError("Email, password and Thai name are required");
      return;
    }
    setSaving(true);
    setError("");

    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password,
        name_th: nameTh.trim(),
        name_en: nameEn.trim() || nameTh.trim(),
        phone: phone.trim() || undefined,
        role,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Unknown error");
      return;
    }

    onAdded(data.member as Member);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>
            เพิ่มสมาชิก
            <small style={{ display: "block", fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Add team member</small>
          </h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={24} /></button>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>{error}</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Role */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>ตำแหน่ง · Role *</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
                    border: `2px solid ${role === r.value ? "var(--brand-primary)" : "var(--border)"}`,
                    borderRadius: 10, cursor: "pointer",
                    background: role === r.value ? "#EFF6FF" : "white",
                  }}
                >
                  <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} style={{ marginTop: 3, accentColor: "var(--brand-primary)" }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 14 }}>{r.th} · {r.en}</strong>
                    <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>{r.desc}</small>
                  </div>
                  {role === r.value && <Check size={16} color="var(--brand-primary)" style={{ flexShrink: 0, marginTop: 2 }} />}
                </label>
              ))}
            </div>
          </div>

          {/* Name */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>ชื่อภาษาไทย *</span>
              <input value={nameTh} onChange={(e) => setNameTh(e.target.value)} placeholder="ชื่อ นามสกุล" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Name (English)</span>
              <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="First Last" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
            </label>
          </div>

          {/* Phone */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>เบอร์โทร (optional)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="+66 8X XXX XXXX" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
          </label>

          {/* Login */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>ข้อมูลการเข้าสู่ระบบ · Login credentials</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Email *</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="manager@example.com" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} autoComplete="off" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Temporary password * (min 6 chars)</span>
                <div style={{ position: "relative" }}>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPw ? "text" : "password"}
                    placeholder="••••••"
                    style={{ width: "100%", padding: "9px 40px 9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                    autoComplete="new-password"
                  />
                  <button onClick={() => setShowPw((p) => !p)} type="button" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
                    {showPw ? <EyeOff size={16} color="var(--text-muted)" /> : <Eye size={16} color="var(--text-muted)" />}
                  </button>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", border: "1px solid var(--border)", borderRadius: 10, background: "white", cursor: "pointer", fontSize: 14 }}>
            <span className="th-text">ยกเลิก</span><span className="en-text">Cancel</span>
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: "center" }}>
            {saving
              ? <><span className="th-text">กำลังสร้าง…</span><span className="en-text">Creating…</span></>
              : <><span className="th-text">สร้างบัญชี</span><span className="en-text">Create account</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}
