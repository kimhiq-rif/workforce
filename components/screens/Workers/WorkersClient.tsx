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
  phone_verified?: boolean;
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
  const [showCheckinModal, setShowCheckinModal] = useState(false);
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
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-primary" onClick={() => setShowCheckinModal(true)}
                  style={{ background: "#059669", borderColor: "#059669" }}>
                  📋 ส่งเช็คอิน
                  <small>Send Check-in</small>
                </button>
                <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                  <CirclePlus size={20} />
                  เพิ่มพนักงาน
                  <small>Add worker</small>
                </button>
              </div>
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
              <span><span className="th-text">พนักงาน</span><span className="en-text">Worker</span></span>
              <span><span className="th-text">ไซต์</span><span className="en-text">Site</span></span>
              <span><span className="th-text">เวลาเข้า</span><span className="en-text">Arrival</span></span>
              <span><span className="th-text">สถานะ</span><span className="en-text">Status</span></span>
              <span><span className="th-text">ค่าแรง</span><span className="en-text">Wage</span></span>
              <span><span className="th-text">การจัดการ</span><span className="en-text">Actions</span></span>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                <span className="th-text">ไม่พบพนักงาน</span>
              <span className="en-text">No workers found</span>
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
                      <div className="avatar" style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0, overflow: "hidden", padding: 0 }}>
                        {(worker as any).photo_url
                          ? <img src={(worker as any).photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : worker.name_th[0]}
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
            onCheckin={() => setShowCheckinModal(true)}
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

      {showCheckinModal && (
        <CheckinSendModal
          workers={workers}
          onClose={() => setShowCheckinModal(false)}
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
  workers, attendanceMap, stats, tab, setTab, search, setSearch, onAdd, onCheckin, isOwner,
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
  onCheckin: () => void;
  onArchive: (worker: WorkerWithSite) => void;
  isOwner: boolean;
}) {
  return (
    <div>
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>
            <span className="th-text">พนักงาน</span>
            <span className="en-text">Workers</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>
            <span className="th-text">{stats.total} คน</span>
            <span className="en-text">{stats.total} workers</span>
          </p>
        </div>
        {isOwner && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onCheckin} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", cursor: "pointer", borderRadius: 8, padding: "4px 8px", fontSize: 13, fontWeight: 600 }}>
              📋 Check-in
            </button>
            <button onClick={onAdd} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer" }}>
              <CirclePlus size={24} />
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Stats mini row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <div className="mini-stat">
            <strong style={{ color: "#22C55E" }}>{stats.onSite}</strong>
            <span className="th-text">อยู่ในไซต์</span>
            <span className="en-text">On site</span>
          </div>
          <div className="mini-stat">
            <strong style={{ color: "#F97316" }}>{stats.late}</strong>
            <span className="th-text">สาย</span>
            <span className="en-text">Late</span>
          </div>
          <div className="mini-stat">
            <strong style={{ color: "#EF4444" }}>{stats.missing}</strong>
            <span className="th-text">ขาด</span>
            <span className="en-text">Missing</span>
          </div>
        </div>

        {/* Search */}
        <label className="search-box">
          <Search size={20} color="var(--text-muted)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาพนักงาน · Search workers" />
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
              <span className="th-text" style={{ fontSize: 12, fontWeight: tab === t.key ? 700 : 500, lineHeight: 1.3 }}>{t.th}</span>
              <span className="en-text" style={{ fontSize: 12, fontWeight: tab === t.key ? 700 : 500, lineHeight: 1.3 }}>{t.en}</span>
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
                <div className="avatar" style={{ width: 40, height: 40, fontSize: 14, flexShrink: 0, overflow: "hidden", padding: 0 }}>
                  {(worker as any).photo_url
                    ? <img src={(worker as any).photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : worker.name_th[0]}
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
              <span className="th-text">ไม่พบพนักงาน</span>
              <span className="en-text">No workers found</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ABSENT_REASONS = [
  { value: "day_off",    label: "Day off / หยุด" },
  { value: "sick",       label: "Sick / ป่วย" },
  { value: "quit",       label: "Left / ออกแล้ว" },
  { value: "other",      label: "Other / อื่นๆ" },
];

function CheckinSendModal({ workers, onClose }: { workers: WorkerWithSite[]; onClose: () => void }) {
  const verified   = workers.filter((w) => w.phone_verified && w.is_active);
  const unverified = workers.filter((w) => !w.phone_verified && w.is_active);

  const [selected, setSelected]     = useState<Set<string>>(new Set(verified.map((w) => w.id)));
  const [reasons,  setReasons]      = useState<Record<string, string>>({});
  const [loading,  setLoading]      = useState(false);
  const [copyText, setCopyText]     = useState<string | null>(null);
  const [copied,   setCopied]       = useState(false);
  const [error,    setError]        = useState("");

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleGenerate = async () => {
    const workerIds = Array.from(selected);
    if (workerIds.length === 0) { setError("Select at least one worker"); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/checkin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerIds }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Error"); return; }
      setCopyText(json.copyText);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  };

  const handleCopy = async () => {
    if (!copyText) return;
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, padding: "24px 20px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>📋 Send Check-in Links</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>ส่งลิงก์เช็คอินให้พนักงาน</p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={22} /></button>
        </div>

        {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>{error}</div>}

        {copyText ? (
          /* ── Result screen ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}>✓ Links generated — copy and paste to WhatsApp / LINE group</p>
            <textarea
              readOnly
              value={copyText}
              rows={Math.min(copyText.split("\n").length, 14)}
              style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", resize: "none", lineHeight: 1.6 }}
            />
            <button onClick={handleCopy}
              style={{ width: "100%", padding: "12px", borderRadius: 10, background: copied ? "#059669" : "#1E3A8A", color: "white", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 15 }}>
              {copied ? "✓ Copied!" : "📋 Copy All"}
            </button>
            <button onClick={() => { setCopyText(null); setCopied(false); }} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid var(--border)", background: "white", cursor: "pointer", fontSize: 14 }}>
              ← Back / กลับ
            </button>
          </div>
        ) : (
          /* ── Selection screen ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Verified workers */}
            {verified.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Verified workers ({verified.length})
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {verified.map((w) => (
                    <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, border: `2px solid ${selected.has(w.id) ? "#1E3A8A" : "var(--border)"}`, background: selected.has(w.id) ? "#EFF6FF" : "white", cursor: "pointer" }}
                      onClick={() => toggle(w.id)}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${selected.has(w.id) ? "#1E3A8A" : "#D1D5DB"}`, background: selected.has(w.id) ? "#1E3A8A" : "white", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        {selected.has(w.id) && <Check size={13} color="white" strokeWidth={3} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: 14 }}>{w.name_en}</strong>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>{w.name_th}</span>
                      </div>
                      {!selected.has(w.id) && (
                        <select
                          value={reasons[w.id] ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setReasons((prev) => ({ ...prev, [w.id]: e.target.value }))}
                          style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
                          <option value="">Reason?</option>
                          {ABSENT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unverified workers */}
            {unverified.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#F97316", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  ⚠️ Phone not verified ({unverified.length}) — go to worker profile to verify
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {unverified.map((w) => (
                    <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, border: "1px solid #FED7AA", background: "#FFF7ED", opacity: 0.7 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, border: "2px solid #D1D5DB", background: "#F3F4F6", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: 14 }}>{w.name_en}</strong>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>{w.name_th}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#F97316" }}>No phone verified</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {verified.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: 14 }}>
                No workers with verified phones yet.<br />
                Go to a worker profile and tap "Verify Phone".
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "11px", border: "1px solid var(--border)", borderRadius: 10, background: "white", cursor: "pointer", fontSize: 14 }}>
                Cancel / ยกเลิก
              </button>
              <button onClick={handleGenerate} disabled={loading || selected.size === 0}
                style={{ flex: 2, padding: "12px", borderRadius: 10, background: "#059669", color: "white", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 15, opacity: (loading || selected.size === 0) ? 0.5 : 1 }}>
                {loading ? "Generating…" : `Generate Links (${selected.size})`}
              </button>
            </div>
          </div>
        )}
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
    name_th: "", name_en: "",
    phone: "", daily_wage: "500", assigned_site_id: "", is_temporary: false,
    email: "", visa_expiry_date: "", age: "",
  });
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");

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
        phone: form.phone || null, daily_wage: Number(form.daily_wage) || 500,
        assigned_site_id: form.assigned_site_id || null, is_temporary: form.is_temporary,
        email: form.email.trim() || null,
        visa_expiry_date: form.visa_expiry_date || null,
        age: form.age ? Number(form.age) : null,
        photo_url: photoUrl,
      }),
    });
    const workerResult = await workerRes.json();
    if (!workerRes.ok) { setError("เกิดข้อผิดพลาด · " + (workerResult.error ?? "Error")); setSaving(false); return; }

    const newWorker = workerResult.data;

    onAdded(newWorker);
    setSaving(false);
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
          {/* Photo */}
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

          {/* Name + Last name — side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ชื่อ · Name <span style={{ color: "#EF4444" }}>*</span></span>
              <input value={form.name_th} onChange={(e) => setForm((f) => ({ ...f, name_th: e.target.value }))} placeholder="สมชาย" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>นามสกุล · Last name <span style={{ color: "#EF4444" }}>*</span></span>
              <input value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} placeholder="ใจดี" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15 }} />
            </label>
          </div>

          {/* Phone + Wage + Age */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>เบอร์โทร · Phone</span>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="0812345678" type="tel" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ค่าแรง/วัน · Wage ฿</span>
              <input value={form.daily_wage} onChange={(e) => setForm((f) => ({ ...f, daily_wage: e.target.value }))} type="number" min="0" step="50" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>อายุ · Age</span>
              <input value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} type="number" min="15" max="80" placeholder="30" style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
            </label>
          </div>

          {/* Temporary worker toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: `2px solid ${form.is_temporary ? "var(--brand-violet)" : "var(--border)"}`, background: form.is_temporary ? "#F2F4FF" : "white" }}>
            <input type="checkbox" checked={form.is_temporary} onChange={(e) => setForm((f) => ({ ...f, is_temporary: e.target.checked, assigned_site_id: e.target.checked ? f.assigned_site_id : "" }))} style={{ width: 18, height: 18, accentColor: "var(--brand-violet)", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>พนักงานชั่วคราว · Temporary worker</span>
          </label>

          {/* Site — only for temporary workers */}
          {form.is_temporary && sites.length > 0 && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>ไซต์ที่ทำงาน · Site</span>
              <select value={form.assigned_site_id} onChange={(e) => setForm((f) => ({ ...f, assigned_site_id: e.target.value }))} style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, appearance: "none" }}>
                <option value="">ยังไม่กำหนด · Not assigned</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name_th} · {s.name_en}</option>)}
              </select>
            </label>
          )}

          {/* Email — optional */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              อีเมล · Email <small style={{ fontWeight: 400, color: "var(--text-muted)" }}>(ไม่บังคับ · optional)</small>
            </span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="worker@email.com"
              style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
            />
          </label>

          {/* Visa expiry — optional */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              สิ้นสุดวีซ่า · Visa expiry <small style={{ fontWeight: 400, color: "var(--text-muted)" }}>(ไม่บังคับ · optional)</small>
            </span>
            <input
              type="date"
              value={form.visa_expiry_date}
              onChange={(e) => setForm((f) => ({ ...f, visa_expiry_date: e.target.value }))}
              style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px", border: "1px solid var(--border)", borderRadius: 10, background: "white", cursor: "pointer", fontSize: 14 }}>
            <span className="th-text">ยกเลิก</span>
            <span className="en-text">Cancel</span>
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: "center" }}>
            {saving
              ? <><span className="th-text">กำลังบันทึก…</span><span className="en-text">Saving…</span></>
              : <><span className="th-text">บันทึก</span><span className="en-text">Save</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}
