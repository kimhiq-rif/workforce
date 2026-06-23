"use client";
// Copyright © 2026 Workforce. All rights reserved.
// Project Final — live presentation mode. Fullscreen slide-by-slide deck for the
// owner to present a finished project. No chart (per design choice) — big numbers,
// stage-by-stage slides, workforce + suppliers + exceptions. Keyboard + tap nav.
import { useCallback, useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { ProjectFinalReportData } from "@/lib/project-final-report";

const VIOLET = "#6C5CE7";

function shortDate(iso: string) {
  return String(iso ?? "").slice(0, 10);
}

export function ProjectFinalPresent({ report, onClose }: { report: ProjectFinalReportData; onClose: () => void }) {
  const { site, period, totals, exceptions, stages, workers, suppliers } = report;

  const slides = useMemo(() => {
    const list: { kind: string; node: React.ReactNode }[] = [];

    // Cover
    list.push({
      kind: "cover",
      node: (
        <Center>
          <Badge>{site.isClosed ? (site.closeReason === "stopped_cancelled" ? "หยุด/ยกเลิก · Stopped" : "เสร็จสมบูรณ์ · Completed") : "กำลังดำเนินการ · Active"}</Badge>
          <div style={{ fontSize: 52, fontWeight: 800, marginTop: 18, lineHeight: 1.05 }}>{site.nameTh}</div>
          <div style={{ fontSize: 22, color: "#A9B0D0", marginTop: 8 }}>{site.nameEn}</div>
          <div style={{ fontSize: 17, color: "#A9B0D0", marginTop: 24 }}>
            {period.start} → {period.end} · {period.durationDays} วัน · {site.projectType === "long" ? "Long project" : "Short project"}
          </div>
          <div style={{ marginTop: 40 }}>
            <div style={{ fontSize: 16, color: "#A9B0D0" }}>ต้นทุนรวม · Total cost</div>
            <div style={{ fontSize: 72, fontWeight: 800, color: "#B9B0FF", lineHeight: 1.05 }}>฿{formatCurrency(totals.totalCost)}</div>
          </div>
        </Center>
      ),
    });

    // One slide per stage (long projects)
    stages.forEach((s, i) => {
      list.push({
        kind: "stage",
        node: (
          <Center>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, background: s.color }} />
              <span style={{ fontSize: 18, color: "#A9B0D0" }}>ขั้นที่ {i + 1} / {stages.length} · Stage</span>
            </div>
            <div style={{ fontSize: 48, fontWeight: 800, marginTop: 16 }}>{s.nameTh || s.nameEn}</div>
            <div style={{ fontSize: 20, color: "#A9B0D0", marginTop: 6 }}>{s.nameEn}</div>
            <div style={{ fontSize: 18, color: "#A9B0D0", marginTop: 28 }}>{shortDate(s.periodFrom)} → {shortDate(s.periodTo)} · {s.workDays} วันทำงาน</div>
            <div style={{ fontSize: 56, fontWeight: 800, color: "#B9B0FF", marginTop: 20 }}>฿{formatCurrency(s.totalCost)}</div>
          </Center>
        ),
      });
    });

    // Cost breakdown (no chart — big numbers)
    list.push({
      kind: "cost",
      node: (
        <Center>
          <SlideTitle th="ต้นทุน" en="Cost breakdown" />
          <div style={{ display: "flex", gap: 48, marginTop: 36, flexWrap: "wrap", justifyContent: "center" }}>
            <BigStat label="ค่าแรง · Labor" value={`฿${formatCurrency(totals.laborCost)}`} />
            <BigStat label="ใบเสร็จ · Receipts" value={`฿${formatCurrency(totals.receiptCost)}`} />
            <BigStat label="ล่วงเวลา · OT" value={`฿${formatCurrency(totals.overtimeCost)}`} />
          </div>
        </Center>
      ),
    });

    // Workforce
    list.push({
      kind: "workforce",
      node: (
        <Center>
          <SlideTitle th="กำลังคน" en="Workforce" />
          <div style={{ display: "flex", gap: 48, marginTop: 28, justifyContent: "center" }}>
            <BigStat label="วันทำงาน · Worker-days" value={String(totals.workerDays)} />
            <BigStat label="คนงาน · Workers" value={String(totals.uniqueWorkers)} />
          </div>
          {workers.length > 0 && (
            <div style={{ marginTop: 36, width: "min(560px, 90vw)" }}>
              {workers.slice(0, 5).map((w) => (
                <PresentRow key={w.id} left={w.nameEn || w.nameTh} mid={`${w.days}d`} right={`฿${formatCurrency(w.totalCost)}`} />
              ))}
            </div>
          )}
        </Center>
      ),
    });

    // Suppliers
    if (suppliers.length > 0) {
      list.push({
        kind: "suppliers",
        node: (
          <Center>
            <SlideTitle th="ผู้ขาย" en="Suppliers" />
            <div style={{ marginTop: 28, width: "min(560px, 90vw)" }}>
              {suppliers.slice(0, 6).map((s) => (
                <PresentRow key={s.id} left={s.nameEn || s.nameTh} mid={`${s.count}×`} right={`฿${formatCurrency(s.receiptCost)}`} />
              ))}
            </div>
          </Center>
        ),
      });
    }

    // Exceptions
    list.push({
      kind: "exceptions",
      node: (
        <Center>
          <SlideTitle th="ข้อยกเว้น" en="Exceptions" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28, marginTop: 32, width: "min(620px, 92vw)" }}>
            <BigStat label="สาย · Late" value={String(exceptions.lateCount)} />
            <BigStat label="ครึ่งวัน · Half" value={String(exceptions.halfDayCount)} />
            <BigStat label="ขาด · Missing" value={String(exceptions.missingCount)} />
            <BigStat label="แก้ไข · Corrections" value={String(exceptions.correctionCount)} />
            <BigStat label="ใบเสร็จ · Receipt" value={String(exceptions.receiptIssueCount)} />
            <BigStat label="GPS" value={String(exceptions.gpsIssueCount)} />
          </div>
        </Center>
      ),
    });

    // Closing
    list.push({
      kind: "closing",
      node: (
        <Center>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{site.nameTh}</div>
          <div style={{ fontSize: 64, fontWeight: 800, color: "#B9B0FF", marginTop: 18 }}>฿{formatCurrency(totals.totalCost)}</div>
          <div style={{ fontSize: 16, color: "#A9B0D0", marginTop: 40 }}>Workforce · Driven by Proof</div>
        </Center>
      ),
    });

    return list;
  }, [site, period, totals, exceptions, stages, workers, suppliers]);

  const [idx, setIdx] = useState(0);
  const next = useCallback(() => setIdx((i) => Math.min(i + 1, slides.length - 1)), [slides.length]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1200, background: "#0B1020", color: "white", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px" }}>
        <span style={{ fontSize: 14, color: "#A9B0D0" }}>{idx + 1} / {slides.length}</span>
        <button onClick={onClose} aria-label="Close presentation" style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: 8, cursor: "pointer", color: "white" }}>
          <X size={22} />
        </button>
      </div>

      {/* Slide */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* tap zones */}
        <button onClick={prev} aria-label="Previous" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "30%", background: "transparent", border: "none", cursor: idx > 0 ? "pointer" : "default" }} />
        <button onClick={next} aria-label="Next" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "30%", background: "transparent", border: "none", cursor: idx < slides.length - 1 ? "pointer" : "default" }} />
        {slides[idx].node}
      </div>

      {/* Bottom controls */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, padding: "16px 20px" }}>
        <button onClick={prev} disabled={idx === 0} aria-label="Previous slide" style={navBtn(idx === 0)}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {slides.map((_, i) => (
            <span key={i} style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 4, background: i === idx ? VIOLET : "rgba(255,255,255,0.25)", transition: "all .2s" }} />
          ))}
        </div>
        <button onClick={next} disabled={idx === slides.length - 1} aria-label="Next slide" style={navBtn(idx === slides.length - 1)}>
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}

function navBtn(disabled: boolean): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 10, padding: 10,
    color: "white", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1,
  };
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px" }}>
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 15, fontWeight: 700, color: "#B9B0FF", background: "rgba(108,92,231,0.18)", padding: "6px 16px", borderRadius: 999 }}>{children}</span>;
}

function SlideTitle({ th, en }: { th: string; en: string }) {
  return (
    <div>
      <div style={{ fontSize: 40, fontWeight: 800 }}>{th}</div>
      <div style={{ fontSize: 18, color: "#A9B0D0", marginTop: 4 }}>{en}</div>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 40, fontWeight: 800, color: "#B9B0FF" }}>{value}</div>
      <div style={{ fontSize: 15, color: "#A9B0D0", marginTop: 6 }}>{label}</div>
    </div>
  );
}

function PresentRow({ left, mid, right }: { left: string; mid: string; right: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
      <span style={{ fontSize: 18, fontWeight: 600 }}>{left}</span>
      <span style={{ fontSize: 15, color: "#A9B0D0" }}>{mid}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: "#B9B0FF" }}>{right}</span>
    </div>
  );
}
