"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Search, CirclePlus, ChevronRight, UserCheck, X, Check, Printer, Trash2, ImagePlus } from "lucide-react";
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
  const [undoWorker, setUndoWorker] = useState<WorkerWithSite | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<WorkerWithSite | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<WorkerWithSite | null>(null);

  const attendanceMap = useMemo(() => {
    const m = new Map<string, AttendanceRow>();
    todayAttendance.forEach((a) => m.set(a.worker_id, a));
    return m;
  }, [todayAttendance]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4500);
  }

  function handleArchiveWorker(worker: WorkerWithSite) {
    if (userRole !== "owner") return;
    setConfirmArchive(worker);
  }

  async function doArchive(worker: WorkerWithSite) {
    setConfirmArchive(null);

    const { error } = await supabase
      .from("workers")
      .update({ is_active: false })
      .eq("id", worker.id)
      .eq("owner_id", ownerId);

    if (error) {
      showToast("เกิดข้อผิดพลาด · Could not archive worker");
      return;
    }

    setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
    if (selectedWorker?.id === worker.id) setSelectedWorker(null);

    // Undo: keep removed worker in state for 5 s
    setUndoWorker(worker);
    const t = setTimeout(() => { setUndoWorker(null); }, 5000);
    setUndoTimer(t);
    setToast(`เก็บ ${worker.name_th} แล้ว · Archived — Undo?`);
  }

  async function handleUndo() {
    if (!undoWorker) return;
    if (undoTimer) clearTimeout(undoTimer);
    setUndoTimer(null);

    await supabase
      .from("workers")
      .update({ is_active: true })
      .eq("id", undoWorker.id)
      .eq("owner_id", ownerId);

    setWorkers((prev) => [undoWorker, ...prev]);
    setUndoWorker(null);
    setToast(`คืนค่า ${undoWorker.name_th} แล้ว · Restored`);
    setTimeout(() => setToast(""), 3000);
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
            <div className="table-header" style={{ gridTemplateColumns: "2.2fr 1.2fr 110px 110px 90px 180px" }}>
              <span>พนักงาน <small>Worker</small></span>
              <span>ไซต์ <small>Site</small></span>
              <span>เวลาเข้า <small>Arrival</small></span>
              <span>สถานะ <small>Status</small></span>
              <span>ค่าแรง <small>Wage</small></span>
              <span>פעולות <small>Actions</small></span>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                ไม่พบพนักงาน · No workers found
              </div>
            ) : (
              filtered.map((worker) => {
                const att = attendanceMap.get(worker.id);
                return (
                  <div
                    key={worker.id}
                    className={`table-row ${selectedWorker?.id === worker.id ? "selected" : ""}`}
                    style={{ gridTemplateColumns: "2.2fr 1.2fr 110px 110px 90px 180px", display: "grid", padding: "12px 20px", gap: 12, alignItems: "center", cursor: "pointer", textDecoration: "none", color: "inherit" }}
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

                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        type="button"
                        title="Open profile"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/workers/${worker.id}`);
                        }}
                        style={{ width: 44, height: 44, border: "1px solid #D9CCFD", borderRadius: 8, background: "#F2F4FF", color: "#6C5CE7", cursor: "pointer", display: "grid", placeItems: "center" }}
                      >
                        <UserCheck size={16} />
                      </button>
                      <button
                        type="button"
                        title="Print worker report"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/workers/${worker.id}/report`, "_blank");
                        }}
                        style={{ width: 44, height: 44, border: "1px solid #BFDBFE", borderRadius: 8, background: "#EFF6FF", color: "#1D4ED8", cursor: "pointer", display: "grid", placeItems: "center" }}
                      >
                        <Printer size={16} />
                      </button>
                      {userRole === "owner" && (
                        <button
                          type="button"
                          title="Archive worker"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveWorker(worker);
                          }}
                          style={{ width: 44, height: 44, border: "1px solid #FECACA", borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", cursor: "pointer", display: "grid", placeItems: "center" }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <ChevronRight size={16} color="var(--text-muted)" />
                    </span>
                  </div>
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
            onArchive={handleArchiveWorker}
            isOwner={userRole === "owner"}
          />
        </div>

        {toast && (
          <div className="toast" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1 }}>{toast}</span>
            {undoWorker && (
              <button
                onClick={handleUndo}
                style={{
                  background: "white", color: "#0E1B3C",
                  border: "none", borderRadius: 6, padding: "4px 10px",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                }}
              >
                Undo
              </button>
            )}
          </div>
        )}
      </DashboardShell>

      {confirmArchive && (
        <ConfirmModal
          title="เก็บถาวรพนักงาน"
          titleEn="Archive worker"
          message={`${confirmArchive.name_th} (${confirmArchive.name_en}) จะออกจากรายการ แต่ประวัติทั้งหมดถูกเก็บไว้ · Worker will leave the active list; all history is saved.`}
          confirmLabel="เก็บถาวร"
          confirmLabelEn="Archive"
          danger
          onConfirm={() => doArchive(confirmArchive)}
          onCancel={() => setConfirmArchive(null)}
        />
      )}

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
  onArchive,
}: {
  workers: WorkerWithSite[];
  attendanceMap: Map<string, AttendanceRow>;
  stats: { total: number; onSite: number; late: number; missing: number };
  tab: string;
  setTab: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  onAdd: () => void;
  onArchive: (worker: WorkerWithSite) => void;
  isOwner: boolean;
}) {
  return (
    <div>
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>Workers</h1>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>{stats.total} total</p>
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
            <span>On site</span>
            <small>On site</small>
          </div>
          <div className="mini-stat">
            <strong style={{ color: "#F97316" }}>{stats.late}</strong>
            <span>Late</span>
            <small>Late</small>
          </div>
          <div className="mini-stat">
            <strong style={{ color: "#EF4444" }}>{stats.missing}</strong>
            <span>Missing</span>
            <small>Missing</small>
          </div>
        </div>

        {/* Search */}
        <label className="search-box">
          <Search size={20} color="var(--text-muted)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workers" />
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
              <span style={{ fontSize: 12, fontWeight: tab === t.key ? 700 : 500, lineHeight: 1.3 }}>{t.en}</span>
            </button>
          ))}
        </div>

        {/* Worker cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {workers.map((worker) => {
            const att = attendanceMap.get(worker.id);
            return (
              <div
                key={worker.id}
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
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    aria-label={`Open ${worker.name_en} profile`}
                    onClick={() => window.location.assign(`/workers/${worker.id}`)}
                    style={{ width: 44, height: 44, border: "1px solid #D9CCFD", borderRadius: 8, background: "#F2F4FF", color: "#6C5CE7", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <UserCheck size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Open ${worker.name_en} report`}
                    onClick={() => window.open(`/workers/${worker.id}/report`, "_blank")}
                    style={{ width: 44, height: 44, border: "1px solid #BFDBFE", borderRadius: 8, background: "#EFF6FF", color: "#1D4ED8", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <Printer size={15} />
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      aria-label={`Archive ${worker.name_en}`}
                      onClick={() => onArchive(worker)}
                      style={{ width: 44, height: 44, border: "1px solid #FECACA", borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", cursor: "pointer", display: "grid", placeItems: "center" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
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
    name_th: "", name_en: "", role_th: "", role_en: "",
    phone: "", daily_wage: "500", assigned_site_id: "", is_temporary: false,
  });
  const [photoFile, setPhotoFile]     = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [appEmail, setAppEmail]       = useState("");
  const [appRole, setAppRole]         = useState<"field_manager" | "technical_admin">("field_manager");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [tempCreds, setTempCreds]     = useState<{ email: string; password: string } | null>(null);
  const [savedWorker, setSavedWorker] = useState<any>(null);

  async function handleSave() {
    if (!form.name_th || !form.name_en) {
      setError("กรุณากรอกชื่อทั้งภาษาไทยและอังกฤษ · Both Thai and English names required");
      return;
    }
    setSaving(true);
    setError("");

    // Upload photo if selected
    let photoUrl: string | null = null;
    if (photoFile) {
      const ext = photoFile.type === "image/png" ? "png" : "jpg";
      const fileName = `workers/${ownerId}/${Date.now()}.${ext}`;
      const { data: uploadData } = await supabase.storage
        .from("worker-photos")
        .upload(fileName, photoFile, { contentType: photoFile.type, upsert: false });
      if (uploadData) {
        photoUrl = supabase.storage.from("worker-photos").getPublicUrl(fileName).data.publicUrl;
      }
    }

    // Step 1: create worker
    const workerRes = await fetch("/api/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name_th: form.name_th, name_en: form.name_en,
        role_th: form.role_th || null, role_en: form.role_en || null,
        phone: form.phone || null, daily_wage: Number(form.daily_wage) || 500,
        assigned_site_id: form.assigned_site_id || null, is_temporary: form.is_temporary,
        photo_url: photoUrl,
      }),
    });
    const workerResult = await workerRes.json();
    if (!workerRes.ok) { setError("เกิดข้อผิดพลาด · " + (workerResult.error ?? "Error")); setSaving(false); return; }

    const newWorker = workerResult.data;

    // Step 2: set up app access if email provided
    if (appEmail.trim()) {
      const accessRes = await fetch("/api/team/set-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_id: newWorker.id, email: appEmail.trim(), role: appRole }),
      });
      const accessResult = await accessRes.json();
      if (!accessRes.ok) { setError("Worker created but access failed: " + (accessResult.error ?? "")); setSaving(false); return; }
      setSavedWorker(newWorker);
      setTempCreds({ email: appEmail.trim(), password: accessResult.temp_password });
    } else {
      onAdded(newWorker);
    }

    setSaving(false);
  }

  // Step 2: show credentials
  if (tempCreds) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "white", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 420 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>สร้างบัญชีสำเร็จ · Account created</h2>
            <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>แชร์ข้อมูลนี้กับพนักงาน · Share these login details with the worker</p>
          </div>
          <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "#6B7280" }}>Email: </span>
              <strong style={{ fontFamily: "monospace" }}>{tempCreds.email}</strong>
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: "#6B7280" }}>Password: </span>
              <strong style={{ fontFamily: "monospace", fontSize: 15, letterSpacing: 1 }}>{tempCreds.password}</strong>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#F97316", marginBottom: 16, textAlign: "center" }}>
            ⚠️ พนักงานจะต้องเปลี่ยนรหัสผ่านเมื่อเข้าครั้งแรก<br/>Worker must change password on first login
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => {
                const text = `🏗️ Workforce App\n\nEmail: ${tempCreds!.email}\nPassword: ${tempCreds!.password}\n\nLink: https://workforce-ivory-delta.vercel.app\n\n⚠️ Please change your password on first login`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
              }}
              style={{ width: "100%", padding: "12px", border: "none", borderRadius: 10, background: "#25D366", color: "white", cursor: "pointer", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              שלח בוואצאפ · Send via WhatsApp
            </button>
            <button onClick={() => onAdded(savedWorker)} className="btn-primary" style={{ justifyContent: "center" }}>
              เสร็จสิ้น · Done
            </button>
          </div>
        </div>
      </div>
    );
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
          {/* Photo picker */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <label style={{ cursor: "pointer" }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: photoPreview ? "transparent" : "var(--surface)",
                border: `2px dashed ${photoPreview ? "var(--brand-violet)" : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", position: "relative",
              }}>
                {photoPreview ? (
                  <Image src={photoPreview} alt="" fill style={{ objectFit: "cover" }} unoptimized />
                ) : (
                  <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    <ImagePlus size={22} />
                    <div style={{ fontSize: 10, marginTop: 2 }}>Photo</div>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setPhotoFile(file);
                  setPhotoPreview(URL.createObjectURL(file));
                }}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ชื่อภาษาไทย *</span>
              <input value={form.name_th} onChange={(e) => setForm((f) => ({ ...f, name_th: e.target.value }))} placeholder="สมชาย" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Name (English) *</span>
              <input value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} placeholder="Somchai" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ตำแหน่ง (ไทย)</span>
              <input value={form.role_th} onChange={(e) => setForm((f) => ({ ...f, role_th: e.target.value }))} placeholder="ช่างปูน" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Role (English)</span>
              <input value={form.role_en} onChange={(e) => setForm((f) => ({ ...f, role_en: e.target.value }))} placeholder="Mason" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>เบอร์โทร Phone</span>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="0812345678" type="tel" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ค่าแรง/วัน Daily wage ฿</span>
              <input value={form.daily_wage} onChange={(e) => setForm((f) => ({ ...f, daily_wage: e.target.value }))} type="number" min="0" step="50" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
            </label>
          </div>
          {sites.length > 0 && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ไซต์ที่ทำงาน Site</span>
              <select value={form.assigned_site_id} onChange={(e) => setForm((f) => ({ ...f, assigned_site_id: e.target.value }))} style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, appearance: "none" }}>
                <option value="">ยังไม่กำหนด · Not assigned</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name_th} · {s.name_en}</option>)}
              </select>
            </label>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_temporary} onChange={(e) => setForm((f) => ({ ...f, is_temporary: e.target.checked }))} style={{ width: 18, height: 18, accentColor: "var(--brand-primary)" }} />
            <span style={{ fontSize: 14 }}><strong>พนักงานชั่วคราว</strong><small style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>Temporary worker</small></span>
          </label>

          {/* App Access section */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1E3A8A", marginBottom: 10 }}>
              🔐 การเข้าถึงแอป · App Access <small style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</small>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Email</span>
                <input
                  type="email"
                  value={appEmail}
                  onChange={(e) => setAppEmail(e.target.value)}
                  placeholder="worker@email.com"
                  style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Role</span>
                <select
                  value={appRole}
                  onChange={(e) => setAppRole(e.target.value as "field_manager" | "technical_admin")}
                  style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, appearance: "none" }}
                >
                  <option value="field_manager">Field Manager — מנהל שטח</option>
                  <option value="technical_admin">Driver Manager — מנהל נהג</option>
                </select>
              </label>
              {appEmail && (
                <div style={{ fontSize: 12, color: "#6B7280", background: "#F9FAFB", borderRadius: 6, padding: "8px 10px" }}>
                  ระบบจะสร้างรหัสผ่านชั่วคราวให้ · System generates a temp password to share with worker
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", border: "1px solid var(--border)", borderRadius: 10, background: "white", cursor: "pointer", fontSize: 14 }}>
            ยกเลิก · Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: "center" }}>
            {saving ? "กำลังบันทึก…" : "บันทึก · Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
