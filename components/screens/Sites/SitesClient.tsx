"use client";
// Copyright © 2026 Workforce. All rights reserved.

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SiteStatusBadge, siteStatusColor } from "@/components/ui/SiteStatusBadge";
import {
  Search, Filter, ChevronRight, CirclePlus, Trash2,
  FileText, ChevronDown,
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

export function SitesClient({ sites: initialSites, ownerId }: SitesClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [sites, setSites] = useState(initialSites);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(sites[0]?.id ?? null);
  const [toast, setToast] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

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

  async function handleAddSite() {
    const name = prompt("ชื่อไซต์ (ภาษาไทย) · Site name (Thai):");
    if (!name) return;
    const nameEn = prompt("ชื่อไซต์ (ภาษาอังกฤษ) · Site name (English):");
    if (!nameEn) return;

    const response = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name_th: name, name_en: nameEn }),
    });
    const result = await response.json();

    if (!response.ok) {
      showToast(`เกิดข้อผิดพลาด · ${result.error ?? "Error adding site"}`);
      return;
    }

    setSites((prev) => [...prev, result.data]);
    setSelectedId(result.data.id);
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
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>Sites management</p>
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
                  <strong style={{ display: "block", fontSize: 16 }}>{site.name_th}</strong>
                  <small style={{ color: "var(--text-muted)", fontSize: 12 }}>{site.name_en} · {site.location_en}</small>
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
