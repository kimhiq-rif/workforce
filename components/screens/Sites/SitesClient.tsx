"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SiteStatusBadge, siteStatusColor } from "@/components/ui/SiteStatusBadge";
import {
  Search, ChevronRight, CirclePlus, Trash2,
  FileText, ChevronDown, X, Wrench, Building2,
} from "lucide-react";
import type { Site, SiteStatus } from "@/types/database";

const STATUS_OPTIONS: { key: string; th: string; en: string }[] = [
  { key: "all",      th: "ทุกสถานะ",      en: "All" },
  { key: "live",     th: "กำลังทำงาน",    en: "Live" },
  { key: "review",   th: "รอตรวจสอบ",     en: "Check" },
  { key: "rain",     th: "ฝน",            en: "Rain" },
  { key: "finished", th: "เสร็จสิ้น",     en: "Finished" },
  { key: "waiting",  th: "รอ",             en: "Waiting" },
  { key: "day_off",  th: "หยุดงาน",       en: "Day off" },
];

interface SitesClientProps {
  sites: (Site & { manager?: { name_th: string; name_en: string } | null })[];
  ownerId: string;
}

interface AddSiteForm {
  name_th: string;
  name_en: string;
  location_th: string;
  location_en: string;
  project_type: "short" | "long";
}

export function SitesClient({ sites: initialSites, ownerId }: SitesClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [sites, setSites] = useState(initialSites);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(sites[0]?.id ?? null);
  const [toast, setToast] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddSiteForm>({
    name_th: "", name_en: "", location_th: "", location_en: "", project_type: "short",
  });
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sites.filter((s) => {
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      const matchSearch =
        !q ||
        s.name_th.toLowerCase().includes(q) ||
        s.name_en.toLowerCase().includes(q) ||
        (s.location_en ?? "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [sites, search, statusFilter]);

  const selectedSite = sites.find((s) => s.id === selectedId) ?? sites[0];

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4500);
  }

  async function handleDelete(siteId: string) {
    if (sites.length <= 1) {
      showToast("ต้องมีอย่างน้อยหนึ่งไซต์ · At least one site required");
      return;
    }
    if (!confirm("ยืนยันการลบไซต์? · Confirm delete site?")) return;
    setDeleting(siteId);

    const { error } = await supabase
      .from("sites")
      .update({ is_active: false })
      .eq("id", siteId);

    setDeleting(null);

    if (error) {
      showToast("เกิดข้อผิดพลาด · Error deleting site");
      return;
    }

    const next = sites.filter((s) => s.id !== siteId);
    setSites(next);
    if (selectedId === siteId) setSelectedId(next[0]?.id ?? null);
    showToast("ลบไซต์แล้ว · Site deleted");
  }

  function handleAddSite() {
    setAddForm({ name_th: "", name_en: "", location_th: "", location_en: "", project_type: "short" });
    setShowAddModal(true);
  }

  async function submitAddSite() {
    if (!addForm.name_th.trim() || !addForm.name_en.trim()) {
      showToast("กรุณากรอกชื่อไซต์ทั้งสองภาษา · Both names required");
      return;
    }
    setAdding(true);
    const response = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    const result = await response.json();
    setAdding(false);
    if (!response.ok) {
      showToast(`เกิดข้อผิดพลาด · ${result.error ?? "Error adding site"}`);
      return;
    }
    setSites((prev) => [...prev, result.data]);
    setSelectedId(result.data.id);
    setShowAddModal(false);
    showToast("เพิ่มไซต์ใหม่แล้ว · Site added");
    router.refresh();
  }

  // ── Right Panel ─────────────────────────────────────────────────────────────
  const rightPanel = (
    <>
      <section className="attention-card">
        <h2>ไซต์ที่เลือก <span>Selected site</span></h2>
        {selectedSite ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span
                className="status-dot"
                style={{ background: siteStatusColor(selectedSite.status), width: 10, height: 10 }}
              />
              <div>
                <strong style={{ fontSize: 16 }}>{selectedSite.name_th}</strong>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{selectedSite.name_en}</div>
              </div>
              <SiteStatusBadge status={selectedSite.status} small />
            </div>
            <Link href={`/sites/${selectedSite.id}`} className="attention-row">
              <span className="attention-icon blue"><FileText size={20} /></span>
              <span>
                <strong style={{ fontSize: 14 }}>เปิดรายละเอียดไซต์</strong>
                <small style={{ fontSize: 11, color: "var(--text-muted)" }}>Open site detail</small>
              </span>
              <ChevronRight size={16} color="var(--text-muted)" />
            </Link>
            <button
              className="attention-row"
              style={{ color: "#B91C1C", cursor: "pointer" }}
              onClick={() => handleDelete(selectedSite.id)}
              disabled={deleting === selectedSite.id}
            >
              <span className="attention-icon red"><Trash2 size={20} /></span>
              <span>
                <strong style={{ fontSize: 14 }}>ลบไซต์</strong>
                <small style={{ fontSize: 11 }}>Delete site</small>
              </span>
            </button>
          </>
        ) : (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>ไม่มีไซต์ · No sites</p>
        )}
      </section>
      <section className="attention-card">
        <h2>กฎการจัดการ <span>Management rule</span></h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          เพิ่มหรือลบไซต์ได้จากหน้าจอนี้เท่านั้น
          <br />
          <em>Add or delete sites only from Sites.</em>
        </p>
      </section>
    </>
  );

  // ── Sites table ──────────────────────────────────────────────────────────────
  const sitesTable = (
    <div className="table-card">
      <div
        className="table-header"
        style={{ gridTemplateColumns: "2fr 1.2fr 80px 80px 70px 50px" }}
      >
        <span>ไซต์ <small>Site</small></span>
        <span>สถานะ <small>Status</small></span>
        <span>รายงาน <small>Reported</small></span>
        <span>คนงาน <small>Workers</small></span>
        <span>ล่าสุด <small>Last</small></span>
        <span />
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          ไม่พบไซต์ · No sites found
        </div>
      ) : (
        filtered.map((site) => (
          <div
            key={site.id}
            className={`table-row ${selectedId === site.id ? "selected" : ""}`}
            style={{
              gridTemplateColumns: "2fr 1.2fr 80px 80px 70px 50px",
              display: "grid",
              alignItems: "center",
            }}
          >
            <button
              className="table-row"
              style={{ gridColumn: "1 / -2", display: "grid", gridTemplateColumns: "2fr 1.2fr 80px 80px 70px", gap: 12, background: "transparent", border: "none", padding: "12px 20px 12px 0", margin: 0 }}
              onClick={() => { setSelectedId(site.id); router.push(`/sites/${site.id}`); }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="status-dot"
                  style={{ background: siteStatusColor(site.status), width: 10, height: 10, flexShrink: 0 }}
                />
                <span>
                  <span className="cell-th">{site.name_th}</span>
                  <span className="cell-en">{site.name_en} · {site.location_en}</span>
                </span>
              </span>
              <span><SiteStatusBadge status={site.status} small /></span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>-</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>-</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>-</span>
            </button>
            <button
              onClick={() => handleDelete(site.id)}
              disabled={deleting === site.id}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#EF4444",
                padding: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label={`Delete ${site.name_en}`}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))
      )}
    </div>
  );

  return (
    <DashboardShell rightPanel={rightPanel}>
      {/* Desktop */}
      <div className="desktop-only">
        <div className="content-header">
          <div>
            <h1>ไซต์</h1>
            <p>Sites management</p>
          </div>
          <button className="btn-primary" onClick={handleAddSite}>
            <CirclePlus size={20} />
            เพิ่มไซต์
            <small>Add site</small>
          </button>
        </div>

        <div className="filter-row">
          <label className="search-box" style={{ flex: 1 }}>
            <Search size={20} color="var(--text-muted)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาไซต์ / Site name"
            />
          </label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                appearance: "none",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 36px 8px 14px",
                fontSize: 14,
                background: "white",
                cursor: "pointer",
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.th} · {opt.en}</option>
              ))}
            </select>
            <ChevronDown size={16} style={{ position: "absolute", right: 10, pointerEvents: "none", color: "var(--text-muted)" }} />
          </div>
        </div>

        {sitesTable}
      </div>

      {/* Mobile */}
      <div className="mobile-only">
        <MobileSites
          sites={filtered}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onAddSite={handleAddSite}
          onDeleteSite={handleDelete}
          deleting={deleting}
        />
      </div>

      {toast && <div className="toast">{toast}</div>}

      {/* Add Site Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div style={{
            background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480,
            boxShadow: "0 20px 60px rgba(80,50,160,0.18)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>เพิ่มไซต์ใหม่</h2>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Add new site / project</p>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={22} />
              </button>
            </div>

            {/* Project type selector */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--text-primary)" }}>
                ประเภทโปรเจกต์ <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>Project type</span>
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  onClick={() => setAddForm(f => ({ ...f, project_type: "short" }))}
                  style={{
                    border: `2px solid ${addForm.project_type === "short" ? "#7C3AED" : "var(--border)"}`,
                    borderRadius: 12, padding: "14px 12px", cursor: "pointer", textAlign: "left",
                    background: addForm.project_type === "short" ? "#F5F3FF" : "white",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Wrench size={18} color={addForm.project_type === "short" ? "#7C3AED" : "var(--text-muted)"} />
                    <strong style={{ fontSize: 14, color: addForm.project_type === "short" ? "#7C3AED" : "var(--text-primary)" }}>Short</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    ซ่อมแซม / ปรับปรุง<br />Repair · Renovation<br />Up to 2 months
                  </p>
                </button>
                <button
                  onClick={() => setAddForm(f => ({ ...f, project_type: "long" }))}
                  style={{
                    border: `2px solid ${addForm.project_type === "long" ? "#FF6A00" : "var(--border)"}`,
                    borderRadius: 12, padding: "14px 12px", cursor: "pointer", textAlign: "left",
                    background: addForm.project_type === "long" ? "#FFF7F0" : "white",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Building2 size={18} color={addForm.project_type === "long" ? "#FF6A00" : "var(--text-muted)"} />
                    <strong style={{ fontSize: 14, color: addForm.project_type === "long" ? "#FF6A00" : "var(--text-primary)" }}>Long</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    ก่อสร้าง<br />Construction<br />8 months – 1.5 years
                  </p>
                </button>
              </div>
            </div>

            {/* Name fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  ชื่อไซต์ (ภาษาไทย) *
                </label>
                <input
                  value={addForm.name_th}
                  onChange={(e) => setAddForm(f => ({ ...f, name_th: e.target.value }))}
                  placeholder="เช่น บ้านเชลอกลาม"
                  style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Site name (English) *
                </label>
                <input
                  value={addForm.name_en}
                  onChange={(e) => setAddForm(f => ({ ...f, name_en: e.target.value }))}
                  placeholder="e.g. CHELOCKLAM"
                  style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    ที่ตั้ง (ไทย)
                  </label>
                  <input
                    value={addForm.location_th}
                    onChange={(e) => setAddForm(f => ({ ...f, location_th: e.target.value }))}
                    placeholder="เช่น เกาะพะงัน"
                    style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Location (EN)
                  </label>
                  <input
                    value={addForm.location_en}
                    onChange={(e) => setAddForm(f => ({ ...f, location_en: e.target.value }))}
                    placeholder="Koh Phangan"
                    style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ flex: 1, padding: "11px", border: "1px solid var(--border)", borderRadius: 10, background: "white", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
              >
                ยกเลิก · Cancel
              </button>
              <button
                onClick={submitAddSite}
                disabled={adding}
                style={{
                  flex: 2, padding: "11px", border: "none", borderRadius: 10, cursor: adding ? "default" : "pointer",
                  fontSize: 14, fontWeight: 700, color: "white",
                  background: addForm.project_type === "long"
                    ? "linear-gradient(135deg, #FF6A00, #FF8C00)"
                    : "linear-gradient(135deg, #7C3AED, #6D28D9)",
                  opacity: adding ? 0.7 : 1,
                }}
              >
                {adding ? "กำลังบันทึก..." : `เพิ่ม${addForm.project_type === "long" ? " Long Project" : " Short Project"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function MobileSites({
  sites, search, setSearch, statusFilter, setStatusFilter,
  onAddSite, onDeleteSite, deleting,
}: {
  sites: any[];
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  onAddSite: () => void;
  onDeleteSite: (id: string) => void;
  deleting: string | null;
}) {
  const SHORT_OPTIONS = [
    { key: "all", th: "ทั้งหมด", en: "All" },
    { key: "live", th: "ทำงาน", en: "Live" },
    { key: "review", th: "ตรวจ", en: "Check" },
    { key: "rain", th: "ฝน", en: "Rain" },
    { key: "day_off", th: "หยุด", en: "Off" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Mobile topbar */}
      <div className="mobile-topbar">
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "white" }}>ไซต์</h1>
          <p style={{ color: "rgba(255,255,255,0.75)" }}>Sites management</p>
        </div>
        <button
          onClick={onAddSite}
          style={{ background: "transparent", border: "none", color: "white", cursor: "pointer" }}
        >
          <CirclePlus size={24} />
        </button>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Search */}
        <label className="search-box">
          <Search size={20} color="var(--text-muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาไซต์"
          />
        </label>

        {/* Status tabs */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {SHORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              style={{
                flexShrink: 0,
                padding: "6px 12px",
                borderRadius: 20,
                border: "1px solid var(--border)",
                background: statusFilter === opt.key ? "var(--brand-primary)" : "white",
                color: statusFilter === opt.key ? "white" : "var(--text-primary)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: statusFilter === opt.key ? 600 : 400,
              }}
            >
              {opt.th}
            </button>
          ))}
        </div>

        {/* Site cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sites.map((site) => (
            <div
              key={site.id}
              className={`mobile-site-card ${site.status}`}
              style={{ position: "relative" }}
            >
              <Link
                href={`/sites/${site.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flex: 1,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span
                  className="status-dot"
                  style={{ background: siteStatusColor(site.status), width: 10, height: 10, flexShrink: 0 }}
                />
                <span style={{ flex: 1 }}>
                  <strong className="cell-th" style={{ display: "block" }}>{site.name_th}</strong>
                  <small className="cell-en">{site.name_en} · {site.location_en}</small>
                </span>
                <SiteStatusBadge status={site.status} small />
                <ChevronRight size={18} color="var(--text-muted)" />
              </Link>
              <button
                onClick={() => onDeleteSite(site.id)}
                disabled={deleting === site.id}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#EF4444",
                  padding: "8px 0 8px 8px",
                  display: "flex",
                }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}

          {sites.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: 14 }}>
              ไม่พบไซต์ · No sites found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
