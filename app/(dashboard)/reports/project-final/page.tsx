// Copyright © 2026 Workforce. All rights reserved.
// Project Final Report — site picker. Lists sites (closed first) linking to each
// site's final report. The primary trigger is the site-close flow; this is the
// discovery entry from the Reports hub.
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, Building2 } from "lucide-react";
import { getAppUserContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export default async function ProjectFinalPickerPage() {
  const { profile, ownerId, serviceClient } = await getAppUserContext();
  if (!profile || !ownerId) redirect("/login");
  if (profile.role !== "owner") redirect("/reports");

  const { data: sites } = await serviceClient
    .from("sites")
    .select("id, name_th, name_en, status, project_type, closed_at, close_reason")
    .eq("owner_id", ownerId)
    .order("closed_at", { ascending: false, nullsFirst: false })
    .order("name_en", { ascending: true });

  const list = sites ?? [];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 60px" }}>
      <Link href="/reports" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 14, textDecoration: "none", marginBottom: 12 }}>
        <ArrowLeft size={16} /> รายงาน · Reports
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>รายงานสรุปโครงการ</h1>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Project Final Report · เลือกโครงการ · pick a project</div>

      {list.length === 0 ? (
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>ไม่มีโครงการ · No projects</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((s) => {
            const closed = Boolean(s.closed_at);
            return (
              <Link
                key={s.id}
                href={`/reports/project-final/${s.id}`}
                style={{ display: "flex", alignItems: "center", gap: 12, background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", textDecoration: "none" }}
              >
                <div style={{ background: "#F2F4FF", borderRadius: 8, padding: 7 }}>
                  <Building2 size={18} color="#6C5CE7" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{s.name_th}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {s.name_en} · {s.project_type === "long" ? "Long" : "Short"}
                    {closed ? ` · ปิดแล้ว ${String(s.closed_at).slice(0, 10)}` : " · กำลังดำเนินการ"}
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
