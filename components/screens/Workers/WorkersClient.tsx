"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Search, CirclePlus, ChevronRight, UserCheck, Clock, Users, X } from "lucide-react";
import { formatCurrency, formatTime } from "@/lib/format";
import type { Worker } from "@/types/database";

type AttendanceRow = {
  worker_id: string;
  arrival_time: string | null;
  status: string;
  is_late: boolean;
  wage_amount: number | null;
  wage_reason: string | null;
};

type WorkerWithSite = Pick<
  Worker,
  | "id"
  | "name_th"
  | "name_en"
  | "role_th"
  | "role_en"
  | "daily_wage"
  | "phone"
  | "is_temporary"
  | "is_active"
  | "assigned_site_id"
> & {
  site?: { id: string; name_th: string; name_en: string; status: string } | null;
};

interface WorkersClientProps {
  workers: WorkerWithSite[];
  todayAttendance: AttendanceRow[];
  sites: { id: string; name_th: string; name_en: string }[];
  ownerId: string;
  today: string;
  userRole?: string;
}

const TABS = [
  { key: "all", th: "ทั้งหมด", en: "All" },
  { key: "on_site", th: "กำลังทำงาน", en: "On site" },
  { key: "late", th: "มาสาย", en: "Late" },
  { key: "missing", th: "ยังไม่รายงาน", en: "Not reported" },
  { key: "temporary", th: "ชั่วคราว", en: "Temporary" },
];

export function WorkersClient({ workers: initialWorkers, todayAttendance, sites, ownerId, today, userRole }: WorkersClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [workers, setWorkers] = useState(initialWorkers);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [toast, setToast] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<WorkerWithSite | null>(null);

  const attendanceMap = useMemo(() => {
    const m = new Map<string, AttendanceRow>();
    todayAttendance.forEach((a) => m.set(a.worker_id, a));
    return m;
  }, [todayAttendance]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4500);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workers.filter((w) => {
      const att = attendanceMap.get(w.id);

      if (tab === "on_site") {
        if (!att || (att.status !== "on_site" && !att.is_late)) return false;
      } else if (tab === "late") {
        if (!att?.is_late) return false;
      } else if (tab === "missing") {
        if (att) return false; // reported = not missing
      } else if (tab === "temporary") {
        if (!w.is_temporary) return false;
      }

      if (q) {
        return (
          w.name_th.toLowerCase().includes(q) ||
          w.name_en.toLowerCase().includes(q) ||
          (w.role_th ?? "").toLowerCase().includes(q) ||
          (w.phone ?? "").includes(q)
        );
      }
      return true;
    });
  }, [workers, tab, search, attendanceMap]);

  const stats = useMemo(() => ({
    total: workers.length,
    onSite: todayAttendance.filter((a) => a.status === "on_site" || a.is_late).length,
    late: todayAttendance.filter((a) => a.is_late).length,
    missing: workers.length - todayAttendance.length,
  }), [workers, todayAttendance]);

  // ── Right panel ─────────────────────────────────────────────────────────────
  const rightPanel = (
    <>
      <section className="attention-card">
        <h2>สรุปวันนี้ <span>Today summary</span></h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>พนักงานทั้งหมด · Total</span>
            <strong>{stats.total}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>กำลังทำงาน · On site</span>
            <strong style={{ color: "#22C55E" }}>{stats.onSite}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>มาสาย · Late</span>
            <strong style={{ color: "#F97316" }}>{stats.late}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>ยังไม่รายงาน · Missing</span>
            <strong style={{ color: "#EF4444" }}>{stats.missing}</strong>
          </div>
        </div>
      </section>

      {selectedWorker && (
        <section className="attention-card">
          <h2>{selectedWorker.name_th} <span>{selectedWorker.name_en}</span></h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>ค่าแรง/วัน</span>
              <strong>฿{formatCurrency(selectedWorker.daily_wage)}</strong>
            </div>
            {selectedWorker.site && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>ไซต์</span>
                <strong>{selectedWorker.site.name_th}</strong>
              </div>
            )}
            {selectedWorker.phone && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>เบอร์</span>
                <a href={`tel:${selectedWorker.phone}`} style={{ color: "var(--brand-primary)" }}>{selectedWorker.phone}</a>
              </div>
            )}
          </div>
          <Link
            href={`/workers/${selectedWorker.id}`}
            className="attention-row"
            style={{ marginTop: 10 }}
          >
            <span className="attention-icon blue"><UserCheck size={20} /></span>
            <span>
              <strong style={{ fontSize: 14 }}>ดูโปรไฟล์</strong>
              <small style={{ fontSize: 11, color: "var(--text-muted)" }}>View worker profile</small>
            </span>
            <ChevronRight size={16} color="var(--text-muted)" />
          </Link>
        </section>
      )}
    </>
  );

  return (
    <>
      <DashboardShell rightPanel={rightPanel}>
        {/* Desktop */}
        <div className="desktop-only">
          <div className="content-header">
            <div>
              <h1>พนักงาน</h1>
              <p>Workers · {stats.total} คน</p>
            </div>
            {userRole === "owner" && (
              <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                <CirclePlus size={20} />
                เพิ่มพนักงาน
                <small>Add worker</small>
              </button>
            )}
          </div>

          {/* Search + tabs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <label className="search-box" style={{ maxWidth: 400 }}>
              <Search size={20} color="var(--text-muted)" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาพนักงาน / Worker name, phone"
              />
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: "1px solid var(--border)",
                    background: tab === t.key ? "var(--brand-primary)" : "white",
                    color: tab === t.key ? "white" : "var(--text-primary)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: tab === t.key ? 600 : 400,
                  }}
                >
                  {t.th}
                  <small style={{ marginLeft: 4, opacity: 0.75 }}>{t.en}</small>
                </button>
              ))}
            </div>
          </div>

          {/* Workers table */}
          <div className="table-card">
            <div className="table-header" style={{ gridTemplateColumns: "2.2fr 1.2fr 110px 110px 90px 80px" }}>
              <span>พนักงาน <small>Worker</small></span>
              <span>ไซต์ <small>Site</small></span>
              <span>เวลาเข้า <small>Arrival</small></span>
              <span>สถานะ <small>Status</small></span>
              <span>ค่าแรง <small>Wage</small></span>
              <span />
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                ไม่พบพนักงาน · No workers found
              </div>
            ) : (
              filtered.map((worker) => {
                const att = attendanceMap.get(worker.id);
                return (
                  <Link
                    key={worker.id}
                    href={`/workers/${worker.id}`}
                    className={`table-row ${selectedWorker?.id === worker.id ? "selected" : ""}`}
                    style={{ gridTemplateColumns: "2.2fr 1.2fr 110px 110px 90px 80px", display: "grid", padding: "12px 20px", gap: 12, alignItems: "center", cursor: "pointer", textDecoration: "none", color: "inherit" }}
                    onClick={() => setSelectedWorker(worker)}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="avatar" style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0 }}>
                        {worker.name_th[0]}
                      </div>
                      <span>
                        <span className="cell-th">{worker.name_th}</span>
                        <span className="cell-en">{worker.name_en} {worker.is_temporary ? "· ชั่วคราว" : ""}</span>
                      </span>
                    </span>

                    <span>
                      {worker.site ? (
                        <>
                          <span className="cell-th" style={{ fontSize: 14 }}>{worker.site.name_th}</span>
                          <span className="cell-en">{worker.site.name_en}</span>
                        </>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>ไม่ระบุ</span>
                      )}
                    </span>

                    <span style={{ fontSize: 15, fontWeight: 600 }}>
                      {att?.arrival_time ? formatTime(att.arrival_time) : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>-</span>}
                    </span>

                    <span>
                      <WorkerStatusBadge att={att} />
                    </span>

                    <span style={{ fontSize: 15, fontWeight: 600 }}>
                      {att?.wage_amount != null ? `฿${formatCurrency(att.wage_amount)}` : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>-</span>}
                    </span>

                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--brand-primary)", fontSize: 13, fontWeight: 600 }}>
                      ดู <ChevronRight size={16} />
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Mobile */}
        <div className="mobile-only">
          <MobileWorkers
            workers={filtered}
            attendanceMap={attendanceMap}
            stats={stats}
            tab={tab}
            setTab={setTab}
            search={search}
            setSearch={setSearch}
            onAdd={() => setShowAddModal(true)}
            isOwner={userRole === "owner"}
          />
        </div>

        {toast && <div className="toast">{toast}</div>}
      </DashboardShell>

      {showAddModal && (
        <AddWorkerModal
          ownerId={ownerId}
          sites={sites}
          onClose={() => setShowAddModal(false)}
          onAdded={(worker) => {
            const normalizedWorker = {
              ...worker,
              site: Array.isArray(worker.site) ? worker.site[0] ?? null : worker.site,
            } as WorkerWithSite;
            setWorkers((prev) => [...prev, normalizedWorker]);
            setShowAddModal(false);
            showToast(`เพิ่ม ${worker.name_th} แล้ว · Worker added`);
          }}
        />
      )}
    </>
  );
}

function WorkerStatusBadge({ att }: { att?: AttendanceRow }) {
  if (!att) {
    return <span style={{ background: "#FEF2F2", color: "#B91C1C", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>ยังไม่รายงาน · Missing</span>;
  }
  if (att.is_late) {
    return <span style={{ background: "#FFF7ED", color: "#C2410C", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>สาย · Late</span>;
  }
  if (att.status === "on_site") {
    return <span style={{ background: "#F0FDF4", color: "#15803D", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>ทำงาน · On site</span>;
  }
  return <span style={{ background: "#F3F4F6", color: "#374151", padding: "3px 8px", borderRadius: 6, fontSize: 11 }}>{att.status}</span>;
}

function MobileWorkers({
  workers, attendanceMap, stats, tab, setTab, search, setSearch, onAdd, isOwner,
}: {
  workers: WorkerWithSite[];
  attendanceMap: Map<string, AttendanceRow>;
  stats: { total: number; onSite: number; late: number; missing: number };
  tab: string;
  setTab: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  onAdd: () => void;
  isOwner: boolean;
}) {
  return (
    <div>
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>พนักงาน</h1>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>Workers · {stats.total} คน</p>
        </div>
        {isOwner && (
          <button onClick={onAdd} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer" }}>
            <CirclePlus size={24} />
          </button>
        )}
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Stats mini row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <div className="mini-stat">
            <strong style={{ color: "#22C55E" }}>{stats.onSite}</strong>
            <span>ทำงาน</span>
            <small>On site</small>
          </div>
          <div className="mini-stat">
            <strong style={{ color: "#F97316" }}>{stats.late}</strong>
            <span>สาย</span>
            <small>Late</small>
          </div>
          <div className="mini-stat">
            <strong style={{ color: "#EF4444" }}>{stats.missing}</strong>
            <span>ไม่รายงาน</span>
            <small>Missing</small>
          </div>
        </div>

        {/* Search */}
        <label className="search-box">
          <Search size={20} color="var(--text-muted)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาพนักงาน" />
        </label>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flexShrink: 0,
                padding: "5px 12px 6px",
                borderRadius: 20,
                border: "1px solid var(--border)",
                background: tab === t.key ? "var(--brand-primary)" : "white",
                color: tab === t.key ? "white" : "var(--text-primary)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: tab === t.key ? 700 : 500, lineHeight: 1.3 }}>{t.th}</span>
              <span style={{ fontSize: 9, opacity: 0.75, lineHeight: 1 }}>{t.en}</span>
            </button>
          ))}
        </div>

        {/* Worker cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {workers.map((worker) => {
            const att = attendanceMap.get(worker.id);
            return (
              <Link
                key={worker.id}
                href={`/workers/${worker.id}`}
                className="mobile-worker-card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="avatar" style={{ width: 40, height: 40, fontSize: 14, flexShrink: 0 }}>
                  {worker.name_th[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <strong className="cell-th" style={{ display: "block" }}>{worker.name_th}</strong>
                  <small className="cell-en">{worker.name_en} · {worker.site?.name_en ?? "Not assigned"}</small>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ display: "block", fontSize: 14 }}>
                    {att?.arrival_time ? formatTime(att.arrival_time) : "-"}
                  </strong>
                  <WorkerStatusBadge att={att} />
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </Link>
            );
          })}
          {workers.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: 14 }}>
              ไม่พบพนักงาน · No workers found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddWorkerModal({
  ownerId, sites, onClose, onAdded,
}: {
  ownerId: string;
  sites: { id: string; name_th: string; name_en: string }[];
  onClose: () => void;
  onAdded: (w: any) => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({
    name_th: "",
    name_en: "",
    role_th: "",
    role_en: "",
    phone: "",
    daily_wage: "500",
    assigned_site_id: "",
    is_temporary: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!form.name_th || !form.name_en) {
      setError("กรุณากรอกชื่อทั้งภาษาไทยและอังกฤษ · Both Thai and English names required");
      return;
    }
    setSaving(true);
    setError("");

    const response = await fetch("/api/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name_th: form.name_th,
        name_en: form.name_en,
        role_th: form.role_th || null,
        role_en: form.role_en || null,
        phone: form.phone || null,
        daily_wage: Number(form.daily_wage) || 500,
        assigned_site_id: form.assigned_site_id || null,
        is_temporary: form.is_temporary,
      }),
    });
    const result = await response.json();

    setSaving(false);

    if (!response.ok) {
      setError("เกิดข้อผิดพลาด · " + (result.error ?? "Error adding worker"));
      return;
    }
    onAdded(result.data);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>เพิ่มพนักงาน <small style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>Add worker</small></h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={24} /></button>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 14 }}>{error}</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ชื่อภาษาไทย *</span>
              <input
                value={form.name_th}
                onChange={(e) => setForm((f) => ({ ...f, name_th: e.target.value }))}
                placeholder="สมชาย"
                style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Name (English) *</span>
              <input
                value={form.name_en}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                placeholder="Somchai"
                style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ตำแหน่ง (ไทย)</span>
              <input
                value={form.role_th}
                onChange={(e) => setForm((f) => ({ ...f, role_th: e.target.value }))}
                placeholder="ช่างปูน"
                style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Role (English)</span>
              <input
                value={form.role_en}
                onChange={(e) => setForm((f) => ({ ...f, role_en: e.target.value }))}
                placeholder="Mason"
                style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>เบอร์โทร Phone</span>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="0812345678"
                type="tel"
                style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ค่าแรง/วัน Daily wage ฿</span>
              <input
                value={form.daily_wage}
                onChange={(e) => setForm((f) => ({ ...f, daily_wage: e.target.value }))}
                type="number"
                min="0"
                step="50"
                style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
              />
            </label>
          </div>

          {sites.length > 0 && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ไซต์ที่ทำงาน Site</span>
              <select
                value={form.assigned_site_id}
                onChange={(e) => setForm((f) => ({ ...f, assigned_site_id: e.target.value }))}
                style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, appearance: "none" }}
              >
                <option value="">ยังไม่กำหนด · Not assigned</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name_th} · {s.name_en}</option>
                ))}
              </select>
            </label>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.is_temporary}
              onChange={(e) => setForm((f) => ({ ...f, is_temporary: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: "var(--brand-primary)" }}
            />
            <span style={{ fontSize: 14 }}>
              <strong>พนักงานชั่วคราว</strong>
              <small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>Temporary worker</small>
            </span>
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "11px", border: "1px solid var(--border)", borderRadius: 10, background: "white", cursor: "pointer", fontSize: 14 }}
          >
            ยกเลิก · Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ flex: 2, justifyContent: "center" }}
          >
            {saving ? "กำลังบันทึก…" : "บันทึก · Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
