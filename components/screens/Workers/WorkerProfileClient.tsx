"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ChevronLeft, ChevronRight, Phone, MapPin, X, Banknote, Pencil, Check, KeyRound, Copy, ShieldCheck } from "lucide-react";
import { formatCurrency, formatThaiDate, formatEnDate, formatTime } from "@/lib/format";
import { wageReasonLabel } from "@/lib/wage-logic";
import type { Worker } from "@/types/database";

type AttendanceRow = {
  event_date: string;
  arrival_time: string | null;
  status: string;
  is_late: boolean;
  wage_amount: number | null;
  wage_reason: string | null;
  site?: { name_th: string; name_en: string } | null;
};

type AdvanceRow = {
  id: string;
  amount: number;
  reason: string | null;
  status: string;
  created_at: string;
};

interface WorkerProfileClientProps {
  worker: Worker & { site?: { id: string; name_th: string; name_en: string; status: string } | null };
  attendanceHistory: AttendanceRow[];
  advances: AdvanceRow[];
  sites: { id: string; name_th: string; name_en: string }[];
  ownerId: string;
  today: string;
  userRole?: string;
}

export function WorkerProfileClient({ worker: initialWorker, attendanceHistory, advances: initialAdvances, sites, ownerId, today, userRole }: WorkerProfileClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [worker, setWorker] = useState(initialWorker);
  const [advances, setAdvances] = useState(initialAdvances);
  const [toast, setToast] = useState("");
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWage, setEditingWage] = useState(false);
  const [newWage, setNewWage] = useState(String(initialWorker.daily_wage));
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [resetCreds, setResetCreds] = useState<{ email: string; password: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [copiedCreds, setCopiedCreds] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 5000);
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const daysWorked = attendanceHistory.filter((a) => a.status !== "missing" && a.wage_amount && a.wage_amount > 0).length;
  const totalEarned = attendanceHistory.reduce((s, a) => s + (a.wage_amount ?? 0), 0);
  const lateDays = attendanceHistory.filter((a) => a.is_late).length;
  const pendingAdvances = advances.filter((a) => a.status === "pending").reduce((s, a) => s + a.amount, 0);

  async function handleSaveWage() {
    const wage = Number(newWage);
    if (!wage || wage <= 0) return;

    const { error } = await supabase
      .from("workers")
      .update({ daily_wage: wage })
      .eq("id", worker.id);

    if (error) { showToast("เกิดข้อผิดพลาด · Error"); return; }
    setWorker((w) => ({ ...w, daily_wage: wage }));
    setEditingWage(false);
    showToast(`อัปเดตค่าแรงเป็น ฿${formatCurrency(wage)} แล้ว`);
  }

  async function handleReassignSite(siteId: string) {
    const { error } = await supabase
      .from("workers")
      .update({ assigned_site_id: siteId || null })
      .eq("id", worker.id);

    if (!error) router.refresh();
  }

  async function handleDeactivate() {
    if (!confirm(`ยืนยันการลบ ${worker.name_th}? · Confirm deactivate?`)) return;
    await supabase.from("workers").update({ is_active: false }).eq("id", worker.id);
    router.push("/workers");
  }

  async function handleResetPassword() {
    if (!confirm(`รีเซ็ตรหัสผ่านของ ${worker.name_en}? · Reset password?`)) return;
    setResetting(true);
    const res = await fetch("/api/team/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker_id: worker.id }),
    });
    const data = await res.json();
    setResetting(false);
    if (!res.ok) { showToast("Error: " + (data.error ?? "Failed")); return; }
    setResetCreds({ email: data.email, password: data.temp_password });
  }

  async function copyCredsToClipboard() {
    if (!resetCreds) return;
    await navigator.clipboard.writeText(`Email: ${resetCreds.email}\nPassword: ${resetCreds.password}`);
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2000);
  }

  // ── Right panel ─────────────────────────────────────────────────────────────
  const rightPanel = (
    <>
      <section className="attention-card">
        <h2>สถิติ 30 วัน <span>30-day stats</span></h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {[
            { th: "วันทำงาน", en: "Days worked", val: daysWorked, color: "#22C55E" },
            { th: "มาสาย", en: "Late days", val: lateDays, color: "#F97316" },
            { th: "รายได้รวม", en: "Total earned", val: `฿${formatCurrency(totalEarned)}`, color: "var(--text-primary)" },
            { th: "เบิกค้างจ่าย", en: "Pending advance", val: pendingAdvances > 0 ? `฿${formatCurrency(pendingAdvances)}` : "ไม่มี", color: pendingAdvances > 0 ? "#EF4444" : "#22C55E" },
          ].map((item) => (
            <div key={item.th} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-muted)" }}>{item.th} · {item.en}</span>
              <strong style={{ color: item.color }}>{item.val}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="attention-card">
        <h2>ไซต์ที่ทำงาน <span>Assigned site</span></h2>
        <select
          value={worker.assigned_site_id ?? ""}
          onChange={(e) => handleReassignSite(e.target.value)}
          style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "white" }}
        >
          <option value="">ยังไม่กำหนด · Not assigned</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name_th} · {s.name_en}</option>
          ))}
        </select>
      </section>

      {/* App Access section — only for owner */}
      {userRole === "owner" && (
        <section className="attention-card">
          <h2><ShieldCheck size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />การเข้าถึงแอป <span>App Access</span></h2>

          {worker.auth_user_id ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Email: <strong style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: 12 }}>{worker.login_email ?? "—"}</strong>
              </div>

              {resetCreds ? (
                <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, marginBottom: 4, color: "#0369A1", fontWeight: 600 }}>รหัสผ่านใหม่ · New temp password</div>
                  <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>{resetCreds.password}</div>
                  <button onClick={copyCredsToClipboard} style={{ marginTop: 8, width: "100%", padding: "6px", border: "1px solid #BAE6FD", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    {copiedCreds ? <><Check size={13} color="#22C55E" /> Copied!</> : <><Copy size={13} /> คัดลอก · Copy</>}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleResetPassword}
                  disabled={resetting}
                  style={{ width: "100%", padding: "9px", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <KeyRound size={15} />
                  {resetting ? "กำลังรีเซ็ต…" : "รีเซ็ตรหัสผ่าน · Reset Password"}
                </button>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>ยังไม่มีบัญชี · No app account</div>
              <button
                onClick={() => setShowAccessModal(true)}
                style={{ width: "100%", padding: "9px", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                + ให้สิทธิ์เข้าถึง · Grant Access
              </button>
            </div>
          )}
        </section>
      )}

      <section className="attention-card">
        <button
          onClick={handleDeactivate}
          style={{ width: "100%", padding: "10px", background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}
        >
          ลบพนักงาน · Remove worker
        </button>
      </section>
    </>
  );

  return (
    <>
      <DashboardShell rightPanel={rightPanel}>
        {/* Desktop */}
        <div className="desktop-only">
          <Link href="/workers" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: 13, textDecoration: "none", marginBottom: 10 }}>
            <ChevronLeft size={16} /> กลับ · Back to Workers
          </Link>

          {/* Profile header */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
            <div className="avatar" style={{ width: 72, height: 72, fontSize: 26 }}>{worker.name_th[0]}</div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 31, fontWeight: 700, marginBottom: 2 }}>{worker.name_th}</h1>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{worker.name_en} · {worker.role_th ?? worker.role_en ?? "ไม่ระบุตำแหน่ง"}</p>
              <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                {worker.phone && (
                  <a href={`tel:${worker.phone}`} style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--brand-primary)", fontSize: 13, textDecoration: "none" }}>
                    <Phone size={16} /> {worker.phone}
                  </a>
                )}
                {worker.site && (
                  <Link href={`/sites/${worker.site.id}`} style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--brand-primary)", fontSize: 13, textDecoration: "none" }}>
                    <MapPin size={16} /> {worker.site.name_th}
                  </Link>
                )}
                {worker.is_temporary && (
                  <span style={{ background: "#FFF7ED", color: "#C2410C", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>ชั่วคราว · Temporary</span>
                )}
              </div>
            </div>

            {/* Daily wage editor */}
            <div style={{ textAlign: "right" }}>
              {editingWage ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    value={newWage}
                    onChange={(e) => setNewWage(e.target.value)}
                    type="number"
                    style={{ width: 100, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 18, textAlign: "right" }}
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleSaveWage()}
                  />
                  <button className="btn-primary" style={{ padding: "6px 14px" }} onClick={handleSaveWage}>บันทึก</button>
                  <button onClick={() => { setEditingWage(false); setNewWage(String(worker.daily_wage)); }} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={18} /></button>
                </div>
              ) : (
                <div
                  style={{ fontSize: 26, fontWeight: 700, cursor: "pointer", color: "var(--brand-primary)" }}
                  onClick={() => setEditingWage(true)}
                  title="Click to edit"
                >
                  ฿{formatCurrency(worker.daily_wage)}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
            {userRole === "owner" && (
              <button
                className="btn-primary"
                onClick={() => setShowEditModal(true)}
                style={{ background: "var(--brand-primary)" }}
              >
                <Pencil size={18} />
                แก้ไข
                <small>Edit worker</small>
              </button>
            )}
            <button
              className="btn-primary"
              onClick={() => setShowAdvanceModal(true)}
              style={{ background: "#F59E0B" }}
            >
              <Banknote size={18} />
              บันทึกเบิกเงิน
              <small>Record advance</small>
            </button>
          </div>

          {/* Attendance history */}
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 14 }}>
              ประวัติการทำงาน 30 วัน
              <span style={{ display: "block", fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Attendance history · last 30 days</span>
            </h2>

            <div className="table-card">
              <div className="table-header" style={{ gridTemplateColumns: "1.4fr 1.2fr 110px 110px 100px" }}>
                <span>วันที่ <small>Date</small></span>
                <span>ไซต์ <small>Site</small></span>
                <span>เวลาเข้า <small>Arrival</small></span>
                <span>สถานะ <small>Status</small></span>
                <span>ค่าแรง <small>Wage</small></span>
              </div>

              {attendanceHistory.length === 0 ? (
                <div style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                  ยังไม่มีประวัติ · No attendance history
                </div>
              ) : (
                attendanceHistory.map((a) => {
                  const wl = wageReasonLabel(a.wage_reason);
                  return (
                    <div
                      key={a.event_date}
                      className="table-row"
                      style={{ gridTemplateColumns: "1.4fr 1.2fr 110px 110px 100px", display: "grid", padding: "11px 20px", gap: 12, alignItems: "center" }}
                    >
                      <span>
                        <span className="cell-th">{formatThaiDate(a.event_date)}</span>
                        <span className="cell-en">{formatEnDate(a.event_date)}</span>
                      </span>
                      <span style={{ fontSize: 14 }}>{a.site?.name_th ?? "-"}</span>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>
                        {a.arrival_time ? formatTime(a.arrival_time) : <span style={{ color: "var(--text-muted)" }}>-</span>}
                      </span>
                      <span>
                        <AttHistoryBadge status={a.status} isLate={a.is_late} wageReason={a.wage_reason} />
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>
                        {a.wage_amount != null ? (
                          <span title={wl.th}>฿{formatCurrency(a.wage_amount)}</span>
                        ) : <span style={{ color: "var(--text-muted)" }}>-</span>}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Advances section */}
          {advances.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h2 style={{ fontSize: 19, fontWeight: 600, marginBottom: 14 }}>
                เบิกเงินล่าสุด
                <span style={{ display: "block", fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Recent advances</span>
              </h2>
              <div className="table-card">
                {advances.map((adv) => (
                  <div
                    key={adv.id}
                    style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px", gap: 12, padding: "11px 20px", alignItems: "center", borderBottom: "1px solid var(--border)" }}
                  >
                    <span>
                      <span className="cell-th">{adv.reason ?? "เบิกเงิน"}</span>
                      <span className="cell-en">{formatThaiDate(adv.created_at)}</span>
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>฿{formatCurrency(adv.amount)}</span>
                    <span>
                      <span style={{
                        background: adv.status === "pending" ? "#FFF7ED" : "#F0FDF4",
                        color: adv.status === "pending" ? "#C2410C" : "#15803D",
                        padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                      }}>
                        {adv.status === "pending" ? "ค้างจ่าย" : "จ่ายแล้ว"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mobile */}
        <div className="mobile-only">
          <MobileWorkerProfile
            worker={worker}
            attendanceHistory={attendanceHistory}
            advances={advances}
            stats={{ daysWorked, totalEarned, lateDays, pendingAdvances }}
            onAddAdvance={() => setShowAdvanceModal(true)}
            onEdit={userRole === "owner" ? () => setShowEditModal(true) : undefined}
            onDeactivate={userRole === "owner" ? handleDeactivate : undefined}
          />
        </div>

        {toast && <div className="toast">{toast}</div>}
      </DashboardShell>

      {showAdvanceModal && (
        <AddAdvanceModal
          worker={worker}
          ownerId={ownerId}
          onClose={() => setShowAdvanceModal(false)}
          onAdded={(adv) => {
            setAdvances((prev) => [adv, ...prev]);
            setShowAdvanceModal(false);
            showToast(`บันทึกเบิก ฿${formatCurrency(adv.amount)} แล้ว`);
          }}
        />
      )}

      {showEditModal && (
        <EditWorkerModal
          key={worker.updated_at}
          worker={worker}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setWorker((w) => ({ ...w, ...updated }));
            setNewWage(String(updated.daily_wage ?? worker.daily_wage));
            setShowEditModal(false);
            showToast("อัปเดตข้อมูลพนักงานแล้ว · Worker updated");
          }}
        />
      )}

      {showAccessModal && (
        <GrantAccessModal
          worker={worker}
          onClose={() => setShowAccessModal(false)}
          onGranted={(email, tempPassword) => {
            setWorker((w) => ({ ...w, auth_user_id: "granted", login_email: email }));
            setShowAccessModal(false);
            setResetCreds({ email, password: tempPassword });
            showToast("สร้างบัญชีสำเร็จ · Account created");
          }}
        />
      )}

    </>
  );
}

// ── Grant Access Modal (from worker profile) ───────────────────────────────────
function GrantAccessModal({
  worker, onClose, onGranted,
}: {
  worker: Worker & { site?: any };
  onClose: () => void;
  onGranted: (email: string, tempPassword: string) => void;
}) {
  const [email, setEmail]   = useState("");
  const [role, setRole]     = useState<"field_manager" | "technical_admin">("field_manager");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function handleGrant() {
    if (!email.trim()) { setError("กรุณากรอก email · Email required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/team/set-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker_id: worker.id, email: email.trim(), role }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Error"); return; }
    onGranted(email.trim(), data.temp_password);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>ให้สิทธิ์เข้าถึง <small style={{ fontWeight: 400, color: "#6B7280", fontSize: 13 }}>Grant App Access</small></h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={22} /></button>
        </div>
        {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 14 }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="worker@email.com" style={{ padding: "9px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as "field_manager" | "technical_admin")} style={{ padding: "9px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, appearance: "none" }}>
              <option value="field_manager">Field Manager</option>
              <option value="technical_admin">Driver Manager</option>
            </select>
          </label>
          <div style={{ fontSize: 12, color: "#6B7280", background: "#F9FAFB", borderRadius: 6, padding: "8px 10px" }}>
            ระบบสร้างรหัสผ่านชั่วคราว พนักงานต้องเปลี่ยนเมื่อเข้าครั้งแรก<br/>
            System generates temp password; worker must change it on first login
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", border: "1px solid #D1D5DB", borderRadius: 8, background: "white", cursor: "pointer", fontSize: 14 }}>ยกเลิก</button>
          <button onClick={handleGrant} disabled={saving} style={{ flex: 2, padding: "10px", border: "none", borderRadius: 8, background: "#1E3A8A", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
            {saving ? "กำลังสร้าง…" : "สร้างบัญชี · Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AttHistoryBadge({ status, isLate, wageReason }: { status: string; isLate: boolean; wageReason: string | null }) {
  if (wageReason?.includes("rain")) {
    return <span style={{ background: "#EFF6FF", color: "#1D4ED8", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>ฝน</span>;
  }
  if (isLate) return <span style={{ background: "#FFF7ED", color: "#C2410C", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>สาย · Late</span>;
  if (status === "on_site") return <span style={{ background: "#F0FDF4", color: "#15803D", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>ทำงาน · On site</span>;
  if (status === "half_day_am" || status === "half_day_pm") return <span style={{ background: "#FFFBEB", color: "#B45309", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>ครึ่งวัน</span>;
  return <span style={{ background: "#F3F4F6", color: "#6B7280", padding: "3px 8px", borderRadius: 6, fontSize: 11 }}>{status}</span>;
}

function MobileWorkerProfile({ worker, attendanceHistory, advances, stats, onAddAdvance, onEdit, onDeactivate }: {
  worker: any;
  attendanceHistory: AttendanceRow[];
  advances: AdvanceRow[];
  stats: { daysWorked: number; totalEarned: number; lateDays: number; pendingAdvances: number };
  onAddAdvance: () => void;
  onEdit?: () => void;
  onDeactivate?: () => void;
}) {
  return (
    <div>
      <div className="mobile-topbar">
        <Link href="/workers" className="mobile-topbar-back"><ChevronLeft size={24} /></Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>{worker.name_th}</h1>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>{worker.name_en}</p>
        </div>
        {onEdit && (
          <button onClick={onEdit} className="mobile-topbar-action">
            <Pencil size={15} /> แก้ไข · Edit
          </button>
        )}
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          <div className="mini-stat">
            <strong>{stats.daysWorked}</strong>
            <span>วันทำงาน</span>
            <small>Days</small>
          </div>
          <div className="mini-stat">
            <strong style={{ color: "#F97316" }}>{stats.lateDays}</strong>
            <span>มาสาย</span>
            <small>Late</small>
          </div>
          <div className="mini-stat">
            <strong>฿{formatCurrency(stats.totalEarned)}</strong>
            <span>รายได้รวม</span>
            <small>Earned</small>
          </div>
          <div className="mini-stat">
            <strong style={{ color: stats.pendingAdvances > 0 ? "#EF4444" : "#22C55E" }}>
              {stats.pendingAdvances > 0 ? `฿${formatCurrency(stats.pendingAdvances)}` : "-"}
            </strong>
            <span>เบิกค้างจ่าย</span>
            <small>Advance</small>
          </div>
        </div>

        <button className="btn-primary" style={{ width: "100%", justifyContent: "center", background: "#F59E0B" }} onClick={onAddAdvance}>
          <Banknote size={18} />
          บันทึกเบิกเงิน · Record advance
        </button>

        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>ประวัติการทำงาน <small style={{ color: "var(--text-muted)", fontSize: 12 }}>30-day history</small></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {attendanceHistory.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14, padding: "20px 0" }}>
                ยังไม่มีประวัติ · No history yet
              </div>
            ) : attendanceHistory.slice(0, 20).map((a) => (
              <div key={a.event_date} style={{ background: "white", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--border)" }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{formatThaiDate(a.event_date)}</strong>
                  <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>{a.site?.name_th ?? "-"}</small>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: 14 }}>{a.arrival_time ? formatTime(a.arrival_time) : "-"}</strong>
                  <small style={{ display: "block", color: a.is_late ? "#F97316" : "#22C55E", fontSize: 11 }}>
                    {a.is_late ? "สาย" : a.status === "on_site" ? "ปกติ" : a.status}
                  </small>
                </div>
                <strong style={{ fontSize: 15, minWidth: 70, textAlign: "right" }}>
                  {a.wage_amount != null ? `฿${formatCurrency(a.wage_amount)}` : "-"}
                </strong>
              </div>
            ))}
          </div>
        </div>

        {onDeactivate && (
          <button
            onClick={onDeactivate}
            style={{ width: "100%", padding: "12px", background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}
          >
            ลบพนักงาน · Remove worker
          </button>
        )}
      </div>
    </div>
  );
}

function EditWorkerModal({ worker, onClose, onSaved }: {
  worker: Worker;
  onClose: () => void;
  onSaved: (updated: Partial<Worker>) => void;
}) {
  const supabase = createClient();
  const [nameTh, setNameTh] = useState(worker.name_th ?? "");
  const [nameEn, setNameEn] = useState(worker.name_en ?? "");
  const [roleTh, setRoleTh] = useState(worker.role_th ?? "");
  const [roleEn, setRoleEn] = useState(worker.role_en ?? "");
  const [phone, setPhone] = useState(worker.phone ?? "");
  const [wage, setWage] = useState(String(worker.daily_wage ?? ""));
  const [isTemp, setIsTemp] = useState(worker.is_temporary ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!nameTh.trim()) { setError("ต้องกรอกชื่อภาษาไทย · Thai name required"); return; }
    const wageNum = Number(wage);
    if (!wageNum || wageNum <= 0) { setError("ค่าแรงต้องมากกว่า 0"); return; }
    setSaving(true);

    const patch: Partial<Worker> = {
      name_th: nameTh.trim(),
      name_en: nameEn.trim() || undefined,
      role_th: roleTh.trim() || undefined,
      role_en: roleEn.trim() || undefined,
      phone: phone.trim() || undefined,
      daily_wage: wageNum,
      is_temporary: isTemp,
    };

    const dbPatch = {
      name_th: patch.name_th,
      name_en: patch.name_en ?? null,
      role_th: patch.role_th ?? null,
      role_en: patch.role_en ?? null,
      phone: patch.phone ?? null,
      daily_wage: patch.daily_wage,
      is_temporary: patch.is_temporary,
    };

    const { error: dbError } = await supabase
      .from("workers")
      .update(dbPatch)
      .eq("id", worker.id);

    setSaving(false);
    if (dbError) { setError("เกิดข้อผิดพลาด · " + dbError.message); return; }
    onSaved(patch);
  }

  const field = (label: string, value: string, onChange: (v: string) => void, opts?: { type?: string; placeholder?: string }) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={opts?.type ?? "text"}
        placeholder={opts?.placeholder ?? ""}
        style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
      />
    </label>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>
            แก้ไขข้อมูล <small style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Edit worker</small>
          </h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={24} /></button>
        </div>

        {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {field("ชื่อภาษาไทย · Thai name *", nameTh, setNameTh, { placeholder: "ชื่อ นามสกุล" })}
          {field("ชื่อภาษาอังกฤษ · English name", nameEn, setNameEn, { placeholder: "First Last" })}
          {field("ตำแหน่งภาษาไทย · Thai job title", roleTh, setRoleTh, { placeholder: "ช่างปูน" })}
          {field("ตำแหน่งภาษาอังกฤษ · English job title", roleEn, setRoleEn, { placeholder: "Mason" })}
          {field("เบอร์โทร · Phone", phone, setPhone, { type: "tel", placeholder: "+66 8X XXX XXXX" })}
          {field("ค่าแรง/วัน · Daily wage (฿) *", wage, setWage, { type: "number", placeholder: "400" })}

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8 }}>
            <input
              type="checkbox"
              checked={isTemp}
              onChange={(e) => setIsTemp(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <span style={{ fontSize: 14 }}>ชั่วคราว · Temporary</span>
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", border: "1px solid var(--border)", borderRadius: 10, background: "white", cursor: "pointer", fontSize: 14 }}>
            ยกเลิก · Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: "center" }}>
            <Check size={16} />
            {saving ? "Saving…" : "บันทึก · Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddAdvanceModal({ worker, ownerId, onClose, onAdded }: {
  worker: Worker;
  ownerId: string;
  onClose: () => void;
  onAdded: (adv: AdvanceRow) => void;
}) {
  const supabase = createClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError("กรอกยอดที่ถูกต้อง · Enter valid amount"); return; }
    setSaving(true);

    const { data, error: dbError } = await supabase
      .from("advances")
      .insert({
        owner_id: ownerId,
        worker_id: worker.id,
        amount: amt,
        reason: reason || null,
        status: "pending",
      })
      .select()
      .single();

    setSaving(false);
    if (dbError) { setError("เกิดข้อผิดพลาด · " + dbError.message); return; }
    onAdded(data as AdvanceRow);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>เบิกเงิน <small style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Advance · {worker.name_th}</small></h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={24} /></button>
        </div>

        {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 14 }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>ยอดเงิน Amount (฿) *</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
              step="100"
              placeholder="500"
              style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 18 }}
              autoFocus
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>เหตุผล Reason</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เบิกล่วงหน้า / เงินด่วน"
              style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", border: "1px solid var(--border)", borderRadius: 10, background: "white", cursor: "pointer", fontSize: 14 }}>
            ยกเลิก · Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: "center", background: "#F59E0B" }}>
            {saving ? "กำลังบันทึก…" : "บันทึก · Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
