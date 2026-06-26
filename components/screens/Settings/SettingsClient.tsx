"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getBilingualLabel, useLangMode } from "@/components/layout/useLangMode";
import { Clock, Shield, Phone, Users, Languages, ChevronDown, ChevronLeft, ChevronRight, Check, LogOut, Eye, EyeOff, UserCog, Copy, KeyRound, Building2, Image as ImageIcon, Trash2, Upload, Bell } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface SettingsClientProps {
  profile: any;
  workdaySettings: any;
  teamMembers: any[];
  workers: { id: string; name_th: string; name_en: string; phone: string | null; auth_user_id: string | null }[];
  ownerId: string;
}

const SECTIONS: { key: string; icon: React.ElementType; th: string; en: string; ownerOnly?: boolean }[] = [
  { key: "workday",       icon: Clock,     th: "วันทำงาน",          en: "Workday settings" },
  { key: "admin_code",    icon: KeyRound,  th: "รหัสผู้ดูแล",       en: "Admin code" },
  { key: "security",      icon: Shield,    th: "ห้องเครื่อง",       en: "Engine room" },
  { key: "support",       icon: Phone,     th: "ติดต่อสนับสนุน",    en: "Support" },
  { key: "users",         icon: Users,     th: "ผู้ใช้งาน",         en: "Users & team" },
  { key: "language",      icon: Languages, th: "ภาษา",              en: "Language mode" },
  { key: "password",      icon: KeyRound,  th: "เปลี่ยนรหัสผ่าน",  en: "Change password" },
];

export function SettingsClient({ profile, workdaySettings, teamMembers, workers, ownerId }: SettingsClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [activeSection, setActiveSection] = useState("workday");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  // Workday settings state
  const [workday, setWorkday] = useState({
    start_time: workdaySettings?.start_time ?? "08:00",
    end_time: workdaySettings?.end_time ?? "17:00",
    late_threshold_minutes: workdaySettings?.late_threshold_minutes ?? 15,
    half_day_cutoff_time: workdaySettings?.half_day_cutoff_time ?? "12:00",
    rain_block_after: workdaySettings?.rain_block_after ?? "13:00",
    daily_wage_default: workdaySettings?.daily_wage_default ?? 500,
  });

  // Security / Technical Admin engine room
  const [showCurrentCode, setShowCurrentCode] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [engineRoomCode, setEngineRoomCode] = useState("");
  const [engineRoomOpen, setEngineRoomOpen] = useState(false);
  const [engineRoomError, setEngineRoomError] = useState("");
  const [hostedCompany, setHostedCompany] = useState({
    name: workdaySettings?.hosted_company_name ?? "",
    logoUrl: workdaySettings?.hosted_company_logo_url ?? "",
  });
  const [hostedLogoFile, setHostedLogoFile] = useState<File | null>(null);
  const [hostedLogoPreview, setHostedLogoPreview] = useState<string | null>(workdaySettings?.hosted_company_logo_url ?? null);
  const [hostedBrandSaving, setHostedBrandSaving] = useState(false);

  // Change password state
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwShow, setPwShow] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // Push notification panel state (owner only)
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushRecipient, setPushRecipient] = useState<"owners" | "owners_managers" | "everyone">("everyone");
  const [pushSending, setPushSending] = useState(false);

  async function changePassword() {
    if (pwNew.length < 8) { showToast("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร · Min 8 characters"); return; }
    if (pwNew !== pwConfirm) { showToast("รหัสผ่านไม่ตรงกัน · Passwords do not match"); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setPwSaving(false);
    if (error) { showToast("เกิดข้อผิดพลาด · " + error.message); return; }
    setPwNew(""); setPwConfirm("");
    showToast("เปลี่ยนรหัสผ่านสำเร็จ · Password changed successfully");
  }

  async function handleSendNotification() {
    if (!pushTitle.trim()) return;
    setPushSending(true);
    try {
      const res = await fetch("/api/notifications/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: pushTitle.trim(), body: pushBody.trim(), recipient: pushRecipient }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("เกิดข้อผิดพลาด · Failed to send");
        return;
      }
      showToast(`ส่งแล้ว · Sent to ${data.sent} users`);
      setPushTitle("");
      setPushBody("");
    } finally {
      setPushSending(false);
    }
  }

  // Language mode — persist in localStorage (useEffect avoids SSR mismatch)
  const [langMode, setLangMode] = useState("th-primary");
  useEffect(() => {
    const saved = localStorage.getItem("wf_lang_mode");
    if (saved) setLangMode(saved);
  }, []);

  // Invite state
  const [inviteWorkerId, setInviteWorkerId] = useState("");
  const [inviteRole, setInviteRole] = useState<"field_manager" | "technical_admin">("field_manager");
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteSentEmail, setInviteSentEmail] = useState<string | null>(null);
  const [workerList, setWorkerList] = useState(workers);

  async function handleCreateInvite() {
    if (!inviteWorkerId) return;
    setInviting(true);
    setInviteLink(null);
    setInviteSentEmail(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_id: inviteWorkerId, role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Error"); return; }
      if (json.sent_by_email) {
        setInviteSentEmail(json.email);
      } else {
        setInviteLink(json.invite_url);
      }
      setWorkerList((prev) => prev.map((w) => w.id === inviteWorkerId ? { ...w, auth_user_id: "granted" } : w));
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeAccess(workerId: string, workerName: string) {
    if (!confirm(`Remove app access for ${workerName}?`)) return;
    const res = await fetch("/api/team/invite", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker_id: workerId }),
    });
    if (res.ok) {
      setWorkerList((prev) => prev.map((w) => w.id === workerId ? { ...w, auth_user_id: null } : w));
      showToast("Access removed · ลบสิทธิ์แล้ว");
    }
  }
  function handleLangMode(v: string) {
    setLangMode(v);
    localStorage.setItem("wf_lang_mode", v);
    document.documentElement.setAttribute("data-lang", v);
    window.dispatchEvent(new CustomEvent("wf-lang-change", { detail: v }));
    showToast("Language mode updated · อัปเดตโหมดภาษาแล้ว");
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 5000);
  }

  async function saveWorkday() {
    setSaving(true);
    const { error } = await supabase
      .from("workday_settings")
      .upsert({ owner_id: ownerId, ...workday });
    setSaving(false);
    if (error) { showToast("เกิดข้อผิดพลาด · " + error.message); return; }
    showToast("บันทึกการตั้งค่าวันทำงานแล้ว · Workday settings saved");
  }

  async function saveAdminCode() {
    if (newCode.length < 4) { showToast("รหัสต้องมีอย่างน้อย 4 หลัก · Min 4 digits"); return; }
    if (newCode !== confirmCode) { showToast("รหัสไม่ตรงกัน · Codes don't match"); return; }
    setSaving(true);
    // Update via RPC for secure handling
    const { error } = await supabase.rpc("update_owner_admin_code", {
      p_owner_id: ownerId,
      p_new_code: newCode,
    });
    setSaving(false);
    if (error) { showToast("เกิดข้อผิดพลาด · " + error.message); return; }
    setNewCode("");
    setConfirmCode("");
    showToast("เปลี่ยนรหัสผู้ดูแลแล้ว · Admin code changed");
  }

  async function saveHostedCompanyBrand(next?: { name?: string; logoUrl?: string | null }) {
    const name = next?.name ?? hostedCompany.name;
    let logoUrl = next?.logoUrl ?? hostedCompany.logoUrl;

    setHostedBrandSaving(true);
    if (hostedLogoFile && next?.logoUrl === undefined) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(hostedLogoFile.type)) {
        setHostedBrandSaving(false);
        showToast("Use PNG, JPG, or WebP only · รองรับ PNG, JPG, WebP");
        return;
      }

      const ext = hostedLogoFile.type === "image/png"
          ? "png"
          : hostedLogoFile.type === "image/webp"
            ? "webp"
            : "jpg";
      const fileName = `hosted-company/${ownerId}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("report-assets")
        .upload(fileName, hostedLogoFile, { contentType: hostedLogoFile.type || "image/png", upsert: false });

      if (uploadError || !uploadData) {
        setHostedBrandSaving(false);
        showToast("Logo upload failed · อัปโหลดโลโก้ไม่สำเร็จ");
        return;
      }

      logoUrl = supabase.storage.from("report-assets").getPublicUrl(fileName).data.publicUrl;
    }

    const { error } = await supabase
      .from("workday_settings")
      .upsert({
        owner_id: ownerId,
        hosted_company_name: name || null,
        hosted_company_logo_url: logoUrl || null,
      });

    setHostedBrandSaving(false);
    if (error) {
      showToast("เกิดข้อผิดพลาด · " + error.message);
      return;
    }

    setHostedCompany({ name, logoUrl: logoUrl ?? "" });
    setHostedLogoFile(null);
    setHostedLogoPreview(logoUrl || null);
    showToast("Hosted logo saved · บันทึกโลโก้รายงานแล้ว");
  }

  function handleHostedLogoFile(file: File | null) {
    setHostedLogoFile(file);
    if (!file) {
      setHostedLogoPreview(hostedCompany.logoUrl || null);
      return;
    }
    setHostedLogoPreview(URL.createObjectURL(file));
  }

  async function removeHostedCompanyLogo() {
    if (!hostedCompany.logoUrl && !hostedLogoFile) return;
    if (!confirm("Remove hosted company logo from future reports?")) return;
    setHostedLogoFile(null);
    await saveHostedCompanyBrand({ logoUrl: null });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // ── Right panel ─────────────────────────────────────────────────────────────
  const rightPanel = (
    <section className="attention-card">
      <h2>บัญชีผู้ใช้ <span>Account</span></h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{profile?.name_th ?? "ไม่ระบุ"}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{profile?.name_en ?? ""}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{profile?.email ?? ""}</div>
        <div style={{ fontSize: 12, background: profile?.role === "owner" ? "#EFF6FF" : "#F0FDF4", color: profile?.role === "owner" ? "#1D4ED8" : "#15803D", borderRadius: 6, padding: "3px 8px", display: "inline-block", width: "fit-content", fontWeight: 600 }}>
          {profile?.role === "owner" ? "Owner · เจ้าของ" : "Field Manager · ผู้จัดการ"}
        </div>
      </div>
      <button
        onClick={handleSignOut}
        style={{ marginTop: 16, width: "100%", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, color: "#B91C1C", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
      >
        <LogOut size={18} />
        ออกจากระบบ · Sign out
      </button>
    </section>
  );

  const sectionContent: Record<string, React.ReactNode> = {
    admin_code: (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>รหัสผู้ดูแล <small style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>Admin code</small></h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
          รหัสนี้ใช้สำหรับเข้าห้องเครื่อง (Engine room) และการยืนยันตัวตนระดับสูง
          <br /><em>Used to access the Engine room and high-privilege confirmation screens.</em>
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>รหัสใหม่ <small style={{ fontWeight: 400, color: "var(--text-muted)" }}>New admin code</small></span>
            <input
              type="password"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="อย่างน้อย 4 หลัก · Min 4 digits"
              maxLength={8}
              style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 16, letterSpacing: 4 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>ยืนยันรหัส <small style={{ fontWeight: 400, color: "var(--text-muted)" }}>Confirm code</small></span>
            <input
              type="password"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              placeholder="พิมพ์อีกครั้ง · Repeat code"
              maxLength={8}
              style={{ padding: "10px 12px", border: `1px solid ${confirmCode && confirmCode !== newCode ? "#EF4444" : "var(--border)"}`, borderRadius: 8, fontSize: 16, letterSpacing: 4 }}
            />
            {confirmCode && confirmCode !== newCode && (
              <span style={{ fontSize: 12, color: "#EF4444" }}>รหัสไม่ตรงกัน · Codes don't match</span>
            )}
          </label>
          <button onClick={saveAdminCode} disabled={saving} className="btn-primary" style={{ alignSelf: "flex-start" }}>
            <KeyRound size={18} />
            {saving ? "กำลังบันทึก…" : "บันทึกรหัส · Save admin code"}
          </button>
        </div>
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#92400E", maxWidth: 400 }}>
          <strong>หมายเหตุ:</strong> ถ้าลืมรหัส ติดต่อ Technical Admin เพื่อรีเซ็ต<br />
          <em>Forgot your code? Contact Technical Admin for a reset.</em>
        </div>
      </div>
    ),

    workday: (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>วันทำงาน <small style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>Workday settings</small></h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <TimeField label="เวลาเริ่มงาน Start time" value={workday.start_time} onChange={(v) => setWorkday((w) => ({ ...w, start_time: v }))} />
          <TimeField label="เวลาเลิกงาน End time" value={workday.end_time} onChange={(v) => setWorkday((w) => ({ ...w, end_time: v }))} />
          <TimeField label="ตัดครึ่งวัน Half day cutoff" value={workday.half_day_cutoff_time} onChange={(v) => setWorkday((w) => ({ ...w, half_day_cutoff_time: v }))} />
          <TimeField label="บล็อคฝนหลัง Rain block after" value={workday.rain_block_after} onChange={(v) => setWorkday((w) => ({ ...w, rain_block_after: v }))} />

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>สายเกินกี่นาที Late threshold (min)</span>
            <input type="number" value={workday.late_threshold_minutes} onChange={(e) => setWorkday((w) => ({ ...w, late_threshold_minutes: Number(e.target.value) }))} style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>ค่าแรงเริ่มต้น Default daily wage (฿)</span>
            <input type="number" value={workday.daily_wage_default} onChange={(e) => setWorkday((w) => ({ ...w, daily_wage_default: Number(e.target.value) }))} style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15 }} />
          </label>
        </div>

        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#1D4ED8" }}>
          <strong>Rain logic:</strong> ก่อน {workday.half_day_cutoff_time} = ครึ่งวัน · ก่อน {workday.rain_block_after} = สามารถเปลี่ยนสถานะได้ · หลัง {workday.rain_block_after} = บล็อค (ถามตอน 17:00)
        </div>

        <button onClick={saveWorkday} disabled={saving} className="btn-primary" style={{ alignSelf: "flex-start" }}>
          <Check size={18} />
          {saving ? "กำลังบันทึก…" : "บันทึก · Save workday settings"}
        </button>
      </div>
    ),

    security: (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>ห้องเครื่อง <small style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>Technical Admin · Engine Room</small></h2>

        {!engineRoomOpen ? (
          <>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              ห้องเครื่องใช้สำหรับแก้ไขปัญหาระบบ ตรวจสอบ Logs และจัดการงานเทคนิค
              <br />
              <em>Engine room is for system troubleshooting, logs, sync repair, and technical tools.</em>
            </p>
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#92400E", maxWidth: 440 }}>
              <strong>What is the code?</strong> — The admin code is the same PIN/password you use to log in. It is set once and stored securely. If you have never set a custom code, contact Technical Admin to recover it.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Admin code · הזן קוד כניסה</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showCurrentCode ? "text" : "password"}
                  value={engineRoomCode}
                  onChange={(e) => { setEngineRoomCode(e.target.value); setEngineRoomError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && setEngineRoomOpen(true)}
                  placeholder="••••"
                  maxLength={8}
                  style={{ padding: "10px 44px 10px 14px", border: `1px solid ${engineRoomError ? "#EF4444" : "var(--border)"}`, borderRadius: 8, fontSize: 20, width: "100%", letterSpacing: 6 }}
                />
                <button onClick={() => setShowCurrentCode((v) => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer" }}>
                  {showCurrentCode ? <EyeOff size={18} color="var(--text-muted)" /> : <Eye size={18} color="var(--text-muted)" />}
                </button>
              </div>
              {engineRoomError && <p style={{ color: "#EF4444", fontSize: 13 }}>{engineRoomError}</p>}
            </div>
            <button
              onClick={() => {
                if (!engineRoomCode) { setEngineRoomError("กรุณาใส่รหัส · Enter code"); return; }
                setEngineRoomOpen(true);
              }}
              className="btn-primary"
              style={{ alignSelf: "flex-start" }}
            >
              <Shield size={18} />
              เข้าห้องเครื่อง · Enter engine room
            </button>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 13, color: "#15803D", fontWeight: 600 }}>✓ เข้าถึงห้องเครื่องแล้ว · Engine room access granted</p>
              <button onClick={() => { setEngineRoomOpen(false); setEngineRoomCode(""); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}>ออก · Exit</button>
            </div>

            <div style={{ border: "1px solid #BFDBFE", borderRadius: 12, background: "#F8FAFF", padding: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: "#EFF6FF", color: "var(--brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Building2 size={22} />
                </span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--brand-primary)" }}>
                    โลโก้บริษัทในรายงาน · Hosted company logo
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.45 }}>
                    Appears under Workforce branding in every generated report.
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, alignItems: "stretch" }}>
                <div style={{ minHeight: 118, border: "1px solid var(--border)", borderRadius: 10, background: "white", padding: 12, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 8 }}>
                  {hostedLogoPreview ? (
                    <img
                      src={hostedLogoPreview}
                      alt="Hosted company logo preview"
                      style={{ maxWidth: "100%", maxHeight: 66, objectFit: "contain", display: "block" }}
                    />
                  ) : (
                    <>
                      <ImageIcon size={28} color="var(--text-muted)" />
                      <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>No logo selected</span>
                    </>
                  )}
                  <strong style={{ fontSize: 12, color: "var(--brand-primary)", textAlign: "center" }}>
                    {hostedCompany.name || "Client company"}
                  </strong>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Company name · ชื่อบริษัท</span>
                    <input
                      value={hostedCompany.name}
                      onChange={(e) => setHostedCompany((current) => ({ ...current, name: e.target.value }))}
                      placeholder="Example: ABC Construction"
                      style={{ minHeight: 44, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15 }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Logo file · ไฟล์โลโก้</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleHostedLogoFile(e.target.files?.[0] ?? null)}
                      style={{ minHeight: 44, padding: "9px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "white", fontSize: 13 }}
                    />
                  </label>

                  {hostedCompany.logoUrl && (
                    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Logo URL · URL โลโก้</span>
                      <input
                        value={hostedCompany.logoUrl}
                        onChange={(e) => {
                          setHostedCompany((current) => ({ ...current, logoUrl: e.target.value }));
                          setHostedLogoPreview(e.target.value || null);
                        }}
                        style={{ minHeight: 44, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
                      />
                    </label>
                  )}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button
                      onClick={() => saveHostedCompanyBrand()}
                      disabled={hostedBrandSaving}
                      className="btn-primary"
                      style={{ minHeight: 44 }}
                    >
                      <Upload size={16} />
                      {hostedBrandSaving ? "Saving…" : "Save hosted logo"}
                    </button>
                    <button
                      onClick={removeHostedCompanyLogo}
                      disabled={hostedBrandSaving || (!hostedCompany.logoUrl && !hostedLogoFile)}
                      style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, color: "#B91C1C", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
                    >
                      <Trash2 size={16} />
                      Remove logo
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Push notification panel — owner only */}
            {profile?.role === "owner" && (
              <div style={{ border: "1px solid #BFDBFE", borderRadius: 12, background: "#F8FAFF", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 9, background: "#EFF6FF", color: "var(--brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Bell size={18} />
                  </span>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--brand-primary)" }}>ส่งการแจ้งเตือน · Send notification</h3>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Push to app users</p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input
                    value={pushTitle}
                    onChange={(e) => setPushTitle(e.target.value)}
                    placeholder="หัวข้อ · Title"
                    style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "white" }}
                  />
                  <textarea
                    value={pushBody}
                    onChange={(e) => setPushBody(e.target.value)}
                    placeholder="เนื้อหา · Body (optional)"
                    rows={2}
                    style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, resize: "vertical", background: "white" }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>ผู้รับ · Recipients</span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {([
                        { value: "owners",          th: "เจ้าของ",          en: "Owner" },
                        { value: "owners_managers", th: "เจ้าของ + จัดการ", en: "Owners + FMs" },
                        { value: "everyone",        th: "ทุกคน",            en: "Everyone" },
                      ] as const).map((opt) => (
                        <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", border: `2px solid ${pushRecipient === opt.value ? "var(--brand-primary)" : "var(--border)"}`, borderRadius: 20, cursor: "pointer", background: pushRecipient === opt.value ? "#EFF6FF" : "white", fontSize: 13, fontWeight: pushRecipient === opt.value ? 700 : 400 }}>
                          <input type="radio" name="push-recipient-er" value={opt.value} checked={pushRecipient === opt.value} onChange={() => setPushRecipient(opt.value)} style={{ display: "none" }} />
                          <span className="th-text">{opt.th}</span>
                          <span className="en-text">{opt.en}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleSendNotification}
                    disabled={pushSending || !pushTitle.trim()}
                    className="btn-primary"
                    style={{ alignSelf: "flex-start", minHeight: 40 }}
                  >
                    <Bell size={16} />
                    {pushSending ? "กำลังส่ง… · Sending…" : "ส่ง · Send"}
                  </button>
                </div>
              </div>
            )}

            {[
              { icon: "🖥️", th: "System status", en: "System health & uptime" },
              { icon: "👥", th: "Users & sessions", en: "Active sessions, force logout" },
              { icon: "🔄", th: "Sync queue", en: "Pending syncs, retry failed" },
              { icon: "📤", th: "Failed uploads", en: "Photos, receipts, QR" },
              { icon: "📍", th: "GPS issues", en: "Missing GPS, manual correction" },
              { icon: "🧾", th: "Receipts / QR queue", en: "Stuck payments, pending QR" },
              { icon: "🛠️", th: "Attendance repair", en: "Fix attendance records" },
              { icon: "🏗️", th: "Project tools", en: "Stage reports, project close assist" },
              { icon: "📋", th: "Logs", en: "Errors, user actions, system events" },
              { icon: "📢", th: "Maintenance message", en: "Show message to all users" },
            ].map((tool, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => showToast(`${tool.th} · Coming soon`)}>
                <span style={{ fontSize: 22 }}>{tool.icon}</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 14 }}>{tool.th}</strong>
                  <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>{tool.en}</small>
                </div>
                <ChevronDown size={16} color="var(--text-muted)" style={{ transform: "rotate(-90deg)" }} />
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    support: (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>ติดต่อสนับสนุน <small style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>Support</small></h2>

        <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {[
            { icon: "📧", th: "อีเมล", en: "Email support", detail: "support@workforce.app" },
            { icon: "💬", th: "LINE OA", en: "LINE support", detail: "@workforce" },
            { icon: "📖", th: "คู่มือ", en: "Documentation", detail: "docs.workforce.app" },
            { icon: "🐛", th: "รายงานปัญหา", en: "Report bug", detail: "github.com/workforce/issues" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 15 }}>{item.th}</strong>
                <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>{item.en}</small>
              </div>
              <span style={{ fontSize: 13, color: "var(--brand-primary)" }}>{item.detail}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "var(--surface)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "var(--text-muted)" }}>
          Workforce v1.0.0 · © 2026 All rights reserved.
          <br />Budget: Free tier · Supabase + Vercel · &lt;$8/month
        </div>
      </div>
    ),

    users: (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>ผู้ใช้งาน <small style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>Users & team</small></h2>

        {/* Grant app access */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "20px", background: "white" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            <UserCog size={15} style={{ marginRight: 6, verticalAlign: "middle" }} />
            กำหนดตำแหน่ง · Assign role
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Select a worker and role — generates a one-time invite link to share via LINE or WhatsApp.
          </p>

          {inviteSentEmail ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#15803D", marginBottom: 4 }}>✉️ อีเมลถูกส่งแล้ว · Email sent</p>
                <p style={{ fontSize: 13, color: "#166534" }}>{inviteSentEmail}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>พนักงานจะได้รับลิงก์เข้าสู่ระบบในอีเมล · Worker will receive login link in their inbox</p>
              </div>
              <button onClick={() => { setInviteSentEmail(null); setInviteWorkerId(""); }} style={{ fontSize: 13, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                เชิญคนอื่น · Invite another
              </button>
            </div>
          ) : !inviteLink ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <select
                value={inviteWorkerId}
                onChange={(e) => { setInviteWorkerId(e.target.value); }}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "white" }}
              >
                <option value="">เลือกพนักงาน · Select worker…</option>
                {workerList.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name_th} · {w.name_en}{w.auth_user_id ? " ✓" : ""}
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: 8 }}>
                {(["field_manager", "technical_admin"] as const).map((r) => (
                  <label key={r} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", border: `2px solid ${inviteRole === r ? "var(--brand-primary)" : "var(--border)"}`, borderRadius: 10, cursor: "pointer", background: inviteRole === r ? "#EFF6FF" : "white" }}>
                    <input type="radio" name="inv-role" value={r} checked={inviteRole === r} onChange={() => setInviteRole(r)} style={{ accentColor: "var(--brand-primary)" }} />
                    <span>
                      <strong style={{ display: "block", fontSize: 13 }}>{r === "field_manager" ? "Field Manager" : "Driver Manager"}</strong>
                      <small style={{ color: "var(--text-muted)", fontSize: 11 }}>{r === "field_manager" ? "ผู้จัดการหน้างาน" : "ผู้จัดการขนส่ง"}</small>
                    </span>
                  </label>
                ))}
              </div>

              <button
                className="btn-primary"
                onClick={handleCreateInvite}
                disabled={!inviteWorkerId || inviting}
              >
                <UserCog size={16} />
                {inviting ? "กำลังสร้าง… · Creating…" : "สร้างลิงก์เชิญ · Create invite link"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#15803D", marginBottom: 4 }}>✓ Invite link ready · ลิงก์พร้อมแล้ว</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all" }}>{inviteLink.slice(0, 70)}…</p>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(inviteLink); showToast("Copied · คัดลอกแล้ว"); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}
              >
                <Copy size={16} /> Copy link · คัดลอก
              </button>
              <a href={`https://line.me/R/share?text=${encodeURIComponent("Workforce invite: " + inviteLink)}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", background: "#06C755", color: "white", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
                Share via LINE
              </a>
              <a href={`https://wa.me/?text=${encodeURIComponent("Workforce invite: " + inviteLink)}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", background: "#25D366", color: "white", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
                Share via WhatsApp
              </a>
              <button onClick={() => { setInviteLink(null); setInviteWorkerId(""); }} style={{ fontSize: 13, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                New invite · ลิงก์ใหม่
              </button>
            </div>
          )}
        </div>

        {/* Workers with app access */}
        {workerList.filter((w) => w.auth_user_id).length > 0 && (
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 14, fontWeight: 600 }}>
              มีสิทธิ์เข้าแอป · Has app access ({workerList.filter((w) => w.auth_user_id).length})
            </div>
            {workerList.filter((w) => w.auth_user_id).map((w) => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 14 }}>{w.name_th}</strong>
                  <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>{w.name_en}{w.phone ? ` · ${w.phone}` : ""}</small>
                </div>
                <button
                  onClick={() => { setInviteWorkerId(w.id); setInviteLink(null); handleCreateInvite(); }}
                  style={{ fontSize: 12, padding: "4px 10px", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
                >
                  New link
                </button>
                <button
                  onClick={() => handleRevokeAccess(w.id, w.name_th)}
                  style={{ fontSize: 12, padding: "4px 10px", background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    language: (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>ภาษา <small style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>Language mode</small></h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {([
            {
              value: "th-primary",
              label: "Thai primary (Recommended)",
              preview: <><strong style={{ fontSize: 16 }}>หัดสา</strong><small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>Hadsa · Site name</small></>,
            },
            {
              value: "en-primary",
              label: "English primary",
              preview: <><strong style={{ fontSize: 16 }}>Hadsa</strong><small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>หัดสา · ชื่อไซต์</small></>,
            },
          ] as const).map((opt) => {
            const isActive = langMode === opt.value;
            return (
              <div
                key={opt.value}
                onClick={() => handleLangMode(opt.value)}
                style={{
                  border: `2px solid ${isActive ? "var(--brand-primary)" : "var(--border)"}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  background: isActive ? "#EFF6FF" : "white",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  cursor: "pointer",
                }}
              >
                <div style={{ width: 24, flexShrink: 0 }}>
                  {isActive && <Check size={20} color="var(--brand-primary)" />}
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 14 }}>{opt.label}</strong>
                </div>
                <div style={{ background: "var(--surface)", borderRadius: 8, padding: "8px 14px", minWidth: 120, textAlign: "left", border: "1px solid var(--border)" }}>
                  {opt.preview}
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Changes apply instantly across the entire app and persist after refresh.
        </p>
      </div>
    ),

    password: (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>เปลี่ยนรหัสผ่าน <small style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>Change password</small></h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 400 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>รหัสผ่านใหม่ <small style={{ fontWeight: 400, color: "var(--text-muted)" }}>New password</small></span>
            <div style={{ position: "relative" }}>
              <input
                type={pwShow ? "text" : "password"}
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร · Min 8 characters"
                style={{ width: "100%", padding: "10px 40px 10px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15, boxSizing: "border-box" }}
              />
              <button
                type="button"
                onClick={() => setPwShow((v) => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
              >
                {pwShow ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>ยืนยันรหัสผ่าน <small style={{ fontWeight: 400, color: "var(--text-muted)" }}>Confirm password</small></span>
            <input
              type={pwShow ? "text" : "password"}
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง · Repeat new password"
              style={{ padding: "10px 12px", border: `1px solid ${pwConfirm && pwConfirm !== pwNew ? "#EF4444" : "var(--border)"}`, borderRadius: 8, fontSize: 15 }}
            />
            {pwConfirm && pwConfirm !== pwNew && (
              <span style={{ fontSize: 12, color: "#EF4444" }}>รหัสผ่านไม่ตรงกัน · Passwords do not match</span>
            )}
          </label>

          <button
            onClick={changePassword}
            disabled={pwSaving || !pwNew || !pwConfirm}
            className="btn-primary"
            style={{ alignSelf: "flex-start" }}
          >
            <KeyRound size={18} />
            {pwSaving ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน · Change password"}
          </button>
        </div>

        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#15803D" }}>
          รหัสผ่านจะมีผลทันที ครั้งต่อไปที่เข้าระบบจะใช้รหัสผ่านใหม่
          <br />
          <em>Password change takes effect immediately. Next login will use the new password.</em>
        </div>
      </div>
    ),

  };

  return (
    <>
      <DashboardShell rightPanel={rightPanel}>
        {/* Desktop */}
        <div className="desktop-only">
          <div className="content-header">
            <div>
              <h1>การตั้งค่า</h1>
              <p>Settings</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
            {/* Section nav */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {SECTIONS.filter((s) => !s.ownerOnly || profile?.role === "owner").map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => setActiveSection(s.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: activeSection === s.key ? "#EFF6FF" : "transparent",
                      color: activeSection === s.key ? "var(--brand-primary)" : "var(--text-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontWeight: activeSection === s.key ? 600 : 400,
                      fontSize: 14,
                    }}
                  >
                    <Icon size={18} />
                    <span>
                      <strong style={{ display: "block", fontSize: 14 }}>{s.th}</strong>
                      <small style={{ display: "block", fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{s.en}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Section content */}
            <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 28px" }}>
              {sectionContent[activeSection]}
            </div>
          </div>
        </div>

        {/* Mobile */}
        <div className="mobile-only">
          <MobileSettings
            sections={SECTIONS.filter((s) => !s.ownerOnly || profile?.role === "owner")}
            sectionContent={sectionContent}
            profile={profile}
            onSignOut={handleSignOut}
          />
        </div>

        {toast && <div className="toast">{toast}</div>}
      </DashboardShell>
    </>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15 }} />
    </label>
  );
}

function MobileSettings({ sections, sectionContent, profile, onSignOut }: any) {
  const [open, setOpen] = useState<string | null>(null);
  const langMode = useLangMode();
  const router = useRouter();
  const title = getBilingualLabel(langMode, "การตั้งค่า", "Settings");
  const signOut = getBilingualLabel(langMode, "ออกจากระบบ", "Sign out");
  const activeSection = open ? sections.find((s: any) => s.key === open) : null;

  if (open && activeSection) {
    const Icon = activeSection.icon;
    const label = getBilingualLabel(langMode, activeSection.th, activeSection.en);
    return (
      <div>
        <div className="mobile-topbar">
          <button
            onClick={() => setOpen(null)}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
            aria-label="Back to settings"
          >
            <ChevronLeft size={20} color="white" />
          </button>
          <div style={{ flex: 1, marginLeft: 10 }}>
            <h1 style={{ color: "white" }}>{label.primary}</h1>
            {label.secondary && <p style={{ color: "rgba(255,255,255,0.75)" }}>{label.secondary}</p>}
          </div>
          <span style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={18} color="white" />
          </span>
        </div>
        <div style={{ padding: "16px" }}>
          {sectionContent[open]}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mobile-topbar">
        <button
          onClick={() => router.back()}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginRight: 10 }}
          aria-label="Back"
        >
          <ChevronLeft size={20} color="white" />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>{title.primary}</h1>
          {title.secondary && <p style={{ color: "rgba(255,255,255,0.75)" }}>{title.secondary}</p>}
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Profile info */}
        <div style={{ background: "white", borderRadius: 12, padding: "16px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <div className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>{profile?.name_th?.[0] ?? "?"}</div>
          <div>
            <strong style={{ fontSize: 16 }}>{profile?.name_th ?? "ไม่ระบุ"}</strong>
            <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>{profile?.email ?? ""}</small>
          </div>
        </div>

        {/* Section list — navigation tiles */}
        {sections.map((s: any) => {
          const Icon = s.icon;
          const label = getBilingualLabel(langMode, s.th, s.en);
          return (
            <div key={s.key} style={{ background: "white", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
              <button
                onClick={() => setOpen(s.key)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", border: "none", background: "transparent",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", color: "var(--brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={20} />
                </span>
                <span style={{ flex: 1 }}>
                  <strong style={{ display: "block", fontSize: 15 }}>{label.primary}</strong>
                  {label.secondary && <small style={{ color: "var(--text-muted)", fontSize: 12 }}>{label.secondary}</small>}
                </span>
                <ChevronRight size={20} color="var(--text-muted)" />
              </button>
            </div>
          );
        })}

        {/* Sign out */}
        <button
          onClick={onSignOut}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, color: "#B91C1C", cursor: "pointer", fontSize: 15, fontWeight: 600 }}
        >
          <LogOut size={20} />
          {signOut.secondary ? `${signOut.primary} · ${signOut.secondary}` : signOut.primary}
        </button>
      </div>
    </div>
  );
}
