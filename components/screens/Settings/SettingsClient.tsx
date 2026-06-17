"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Clock, Shield, Phone, Users, Languages, ChevronDown, Check, LogOut, Eye, EyeOff } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface SettingsClientProps {
  profile: any;
  workdaySettings: any;
  teamMembers: any[];
  ownerId: string;
}

const SECTIONS = [
  { key: "workday", icon: Clock, th: "วันทำงาน", en: "Workday settings" },
  { key: "security", icon: Shield, th: "รหัสผู้ดูแล", en: "Admin code" },
  { key: "support", icon: Phone, th: "ติดต่อสนับสนุน", en: "Support" },
  { key: "users", icon: Users, th: "ผู้ใช้งาน", en: "Users & team" },
  { key: "language", icon: Languages, th: "ภาษา", en: "Language mode" },
];

export function SettingsClient({ profile, workdaySettings, teamMembers, ownerId }: SettingsClientProps) {
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

  // Security
  const [showCurrentCode, setShowCurrentCode] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
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
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>รหัสผู้ดูแล <small style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>Admin code</small></h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
          รหัสผู้ดูแลใช้สำหรับยืนยันการดำเนินการที่สำคัญ เช่น การเปลี่ยนสถานะ Rain การแก้ไขข้อมูลที่สำคัญ
          <br />
          <em>Admin code is used to confirm critical actions like changing Rain status or editing sensitive data.</em>
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 480 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>รหัสใหม่ New code</span>
            <div style={{ position: "relative" }}>
              <input
                type={showCurrentCode ? "text" : "password"}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="••••"
                maxLength={8}
                style={{ padding: "9px 40px 9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 18, width: "100%", letterSpacing: 4 }}
              />
              <button
                onClick={() => setShowCurrentCode((v) => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer" }}
              >
                {showCurrentCode ? <EyeOff size={18} color="var(--text-muted)" /> : <Eye size={18} color="var(--text-muted)" />}
              </button>
            </div>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>ยืนยันรหัส Confirm code</span>
            <input
              type="password"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              placeholder="••••"
              maxLength={8}
              style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 18, letterSpacing: 4 }}
            />
          </label>
        </div>

        <button onClick={saveAdminCode} disabled={saving || !newCode} className="btn-primary" style={{ alignSelf: "flex-start" }}>
          <Shield size={18} />
          {saving ? "กำลังบันทึก…" : "เปลี่ยนรหัส · Change code"}
        </button>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>ผู้ใช้งาน <small style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>Users & team</small></h2>
        </div>

        <div className="table-card">
          <div className="table-header" style={{ gridTemplateColumns: "2fr 1fr 1fr 80px" }}>
            <span>ชื่อ <small>Name</small></span>
            <span>บทบาท <small>Role</small></span>
            <span>อีเมล <small>Email</small></span>
            <span>สถานะ <small>Status</small></span>
          </div>
          {teamMembers.map((member) => (
            <div key={member.id} className="table-row" style={{ gridTemplateColumns: "2fr 1fr 1fr 80px", display: "grid", padding: "12px 20px", gap: 12 }}>
              <span>
                <span className="cell-th">{member.name_th}</span>
                <span className="cell-en">{member.name_en}</span>
              </span>
              <span>
                <span style={{ background: member.role === "owner" ? "#EFF6FF" : "#F0FDF4", color: member.role === "owner" ? "#1D4ED8" : "#15803D", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600 }}>
                  {member.role === "owner" ? "Owner" : "Manager"}
                </span>
              </span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{member.email}</span>
              <span style={{ fontSize: 12 }}>
                <span style={{ background: member.is_active ? "#F0FDF4" : "#F3F4F6", color: member.is_active ? "#15803D" : "#6B7280", borderRadius: 6, padding: "3px 8px", fontWeight: 600 }}>
                  {member.is_active ? "Active" : "Inactive"}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#92400E" }}>
          การเพิ่มผู้ใช้งานทำได้ผ่าน Supabase Auth ในปัจจุบัน
          <br />
          <em>Adding team members is currently done via Supabase Auth dashboard.</em>
        </div>
      </div>
    ),

    language: (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>ภาษา <small style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>Language mode</small></h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { value: "th-primary", th: "ไทยเป็นหลัก (แนะนำ)", en: "Thai primary, English secondary — current setting", active: true },
            { value: "en-primary", th: "อังกฤษเป็นหลัก", en: "English primary, Thai secondary", active: false },
            { value: "th-only", th: "ภาษาไทยเท่านั้น", en: "Thai only", active: false },
          ].map((opt) => (
            <div
              key={opt.value}
              style={{
                border: `2px solid ${opt.active ? "var(--brand-primary)" : "var(--border)"}`,
                borderRadius: 10,
                padding: "14px 16px",
                background: opt.active ? "#EFF6FF" : "white",
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}
            >
              {opt.active && <Check size={20} color="var(--brand-primary)" />}
              <div>
                <strong style={{ fontSize: 15 }}>{opt.th}</strong>
                <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>{opt.en}</small>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          ปัจจุบันรองรับเฉพาะ ไทยเป็นหลัก เท่านั้น ตามสเปค Thai-first bilingual UI
          <br />
          <em>Currently only Thai-primary mode is supported per spec.</em>
        </p>
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
              {SECTIONS.map((s) => {
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
            sections={SECTIONS}
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

  return (
    <div>
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>การตั้งค่า</h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>Settings</p>
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

        {/* Accordion sections */}
        {sections.map((s: any) => {
          const Icon = s.icon;
          const isOpen = open === s.key;
          return (
            <div key={s.key} style={{ background: "white", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
              <button
                onClick={() => setOpen(isOpen ? null : s.key)}
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
                  <strong style={{ display: "block", fontSize: 15 }}>{s.th}</strong>
                  <small style={{ color: "var(--text-muted)", fontSize: 12 }}>{s.en}</small>
                </span>
                <ChevronDown size={20} color="var(--text-muted)" style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }} />
              </button>

              {isOpen && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)" }}>
                  <div style={{ paddingTop: 16 }}>{sectionContent[s.key]}</div>
                </div>
              )}
            </div>
          );
        })}

        {/* Sign out */}
        <button
          onClick={onSignOut}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, color: "#B91C1C", cursor: "pointer", fontSize: 15, fontWeight: 600 }}
        >
          <LogOut size={20} />
          ออกจากระบบ · Sign out
        </button>
      </div>
    </div>
  );
}
