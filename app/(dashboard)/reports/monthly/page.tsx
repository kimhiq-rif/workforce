// Copyright © 2026 Workforce. All rights reserved.
import { createClient } from "@/lib/supabase/server";
import { MonthlyReportClient } from "@/components/screens/Reports/MonthlyReportClient";
import { redirect } from "next/navigation";
import { todayBangkok } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { month?: string };
}

export default async function MonthlyReportPage({ searchParams }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, owner_id")
    .eq("auth_id", user.id)
    .single();

  const ownerId = profile?.role === "owner" ? profile.id : profile?.owner_id;

  // Determine which month to show (YYYY-MM)
  const today = todayBangkok();
  const targetMonth = searchParams.month ?? today.slice(0, 7);
  const [year, month] = targetMonth.split("-").map(Number);
  const monthStart = `${targetMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${targetMonth}-${String(lastDay).padStart(2, "0")}`;

  // Sites
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name_th, name_en, status")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_en");

  const siteIds = (sites ?? []).map((s) => s.id);

  // Attendance for the month (photo_lat/lng included for the GPS-issues section)
  const { data: attendance } = siteIds.length
    ? await supabase
        .from("attendance_events")
        .select("id, site_id, worker_id, event_date, wage_amount, status, is_late, photo_lat, photo_lng")
        .in("site_id", siteIds)
        .gte("event_date", monthStart)
        .lte("event_date", monthEnd)
    : { data: [] };

  // Receipts for the month
  const { data: receiptsRaw } = siteIds.length
    ? await supabase
        .from("receipts")
        .select("site_id, supplier_id, amount, status, supplier:supplier_id(name_th, name_en)")
        .in("site_id", siteIds)
        .gte("created_at", `${monthStart}T00:00:00+07:00`)
        .lte("created_at", `${monthEnd}T23:59:59+07:00`)
    : { data: [] };

  // Flatten the joined supplier (Supabase returns it as an array)
  const receipts = (receiptsRaw ?? []).map((r: any) => ({
    site_id: r.site_id,
    supplier_id: r.supplier_id,
    amount: r.amount,
    status: r.status,
    supplier: Array.isArray(r.supplier) ? (r.supplier[0] ?? null) : r.supplier,
  }));

  // Workers (is_temporary drives the temp-workers M5 section)
  const { data: workers } = siteIds.length
    ? await supabase
        .from("workers")
        .select("id, name_th, name_en, assigned_site_id, daily_wage, is_temporary")
        .eq("owner_id", ownerId)
        .eq("is_active", true)
    : { data: [] };

  // Driver cash float given this month
  const { data: driverCashRaw } = await supabase
    .from("driver_cash_entries")
    .select("driver_user_id, amount, created_at, driver:driver_user_id(name_th, name_en)")
    .eq("owner_id", ownerId)
    .gte("created_at", `${monthStart}T00:00:00+07:00`)
    .lte("created_at", `${monthEnd}T23:59:59+07:00`);

  const driverCash = (driverCashRaw ?? []).map((d: any) => ({
    driverId: d.driver_user_id,
    amount: d.amount,
    driver: Array.isArray(d.driver) ? (d.driver[0] ?? null) : d.driver,
  }));

  // Cash differences: per driver, cash given vs cash used (receipts paid from
  // driver cash). A negative remaining (used > given) is the critical anomaly.
  const { data: cashUsedRaw } = await supabase
    .from("receipts")
    .select("submitted_by, amount")
    .eq("owner_id", ownerId)
    .eq("paid_from_driver_cash", true)
    .gte("created_at", `${monthStart}T00:00:00+07:00`)
    .lte("created_at", `${monthEnd}T23:59:59+07:00`);

  const givenByDriver = new Map<string, { name: string; given: number }>();
  for (const d of driverCash) {
    const e = givenByDriver.get(d.driverId) ?? { name: d.driver?.name_th ?? "—", given: 0 };
    e.given += d.amount ?? 0;
    givenByDriver.set(d.driverId, e);
  }
  const usedByDriver = new Map<string, number>();
  for (const r of cashUsedRaw ?? []) {
    if (!r.submitted_by) continue;
    usedByDriver.set(r.submitted_by, (usedByDriver.get(r.submitted_by) ?? 0) + (r.amount ?? 0));
  }
  const cashDifferences: { name: string; given: number; used: number }[] = [];
  for (const [driverId, used] of Array.from(usedByDriver.entries())) {
    const given = givenByDriver.get(driverId)?.given ?? 0;
    if (used > given) {
      cashDifferences.push({ name: givenByDriver.get(driverId)?.name ?? "—", given, used });
    }
  }

  // Edited entries (corrections) this month — full rows for the M5 list + drawer
  const { data: correctionsRows } = await supabase
    .from("corrections")
    .select("id, entity_type, entity_id, field_name, original_value, corrected_value, reason, corrected_by, corrected_at")
    .eq("owner_id", ownerId)
    .gte("corrected_at", `${monthStart}T00:00:00+07:00`)
    .lte("corrected_at", `${monthEnd}T23:59:59+07:00`)
    .order("corrected_at", { ascending: false });
  const editedCount = correctionsRows?.length ?? 0;

  // Advances given this month (operational `advances` table — not payroll deductions)
  const { data: advancesRows } = await supabase
    .from("advances")
    .select("id, worker_id, site_id, amount, notes, created_by, created_at")
    .eq("owner_id", ownerId)
    .gte("created_at", `${monthStart}T00:00:00+07:00`)
    .lte("created_at", `${monthEnd}T23:59:59+07:00`)
    .order("created_at", { ascending: false });

  // Team members, to resolve "performed by" names in correction/advance drawers
  const { data: teamRows } = await supabase
    .from("users")
    .select("id, name_th, name_en")
    .or(`id.eq.${ownerId},owner_id.eq.${ownerId}`);
  const userName = new Map<string, string>();
  for (const u of teamRows ?? []) userName.set(u.id, u.name_th || u.name_en || "—");

  const workerName = new Map<string, string>();
  for (const w of workers ?? []) workerName.set(w.id, w.name_th || w.name_en || "—");
  const siteName = new Map<string, string>();
  for (const s of sites ?? []) siteName.set(s.id, s.name_th || s.name_en || "—");

  // M5 — Advances list
  const advances = (advancesRows ?? []).map((a: any) => ({
    id: a.id,
    workerName: workerName.get(a.worker_id) ?? "—",
    siteName: a.site_id ? (siteName.get(a.site_id) ?? "—") : "—",
    amount: Number(a.amount ?? 0),
    notes: a.notes ?? "",
    by: a.created_by ? (userName.get(a.created_by) ?? "—") : "—",
    date: a.created_at,
  }));

  // M5 — Corrections list
  const corrections = (correctionsRows ?? []).map((c: any) => ({
    id: c.id,
    entityType: c.entity_type ?? "—",
    fieldName: c.field_name ?? "—",
    originalValue: c.original_value ?? "",
    correctedValue: c.corrected_value ?? "",
    reason: c.reason ?? "",
    by: c.corrected_by ? (userName.get(c.corrected_by) ?? "—") : "—",
    date: c.corrected_at,
  }));

  // M5 — Temporary workers: aggregate this month's attendance cost + days
  const tempIds = new Set((workers ?? []).filter((w: any) => w.is_temporary).map((w: any) => w.id));
  const tempAgg = new Map<string, { id: string; name: string; days: number; cost: number }>();
  for (const a of attendance ?? []) {
    if (!tempIds.has(a.worker_id)) continue;
    const isWorkDay = !["missing", "day_off", "rain"].includes(String(a.status ?? ""));
    const e = tempAgg.get(a.worker_id) ?? { id: a.worker_id, name: workerName.get(a.worker_id) ?? "—", days: 0, cost: 0 };
    if (isWorkDay) e.days += 1;
    e.cost += Number(a.wage_amount ?? 0);
    tempAgg.set(a.worker_id, e);
  }
  const tempWorkers = Array.from(tempAgg.values()).sort((a, b) => b.cost - a.cost);

  // M5 — GPS issues: attendance events this month with no photo coordinates
  const gpsIssues = (attendance ?? [])
    .filter((a: any) => a.photo_lat == null || a.photo_lng == null)
    .map((a: any) => ({
      id: a.id,
      workerName: workerName.get(a.worker_id) ?? "—",
      siteName: siteName.get(a.site_id) ?? "—",
      date: a.event_date,
    }));

  // Overtime entries still missing a cost ("remind me later")
  const { data: otMissingRows } = await supabase
    .from("overtime_events")
    .select("id")
    .eq("owner_id", ownerId)
    .is("amount", null)
    .gte("event_date", monthStart)
    .lte("event_date", monthEnd);
  const overtimeMissingCost = otMissingRows?.length ?? 0;

  // Stage transitions this month (a stage_report is generated on each Move Stage)
  const { data: stageTransRaw } = await supabase
    .from("stage_reports")
    .select("site_id, stage_name_th, stage_name_en, stage_color, generated_at, site:site_id(name_th)")
    .eq("owner_id", ownerId)
    .gte("generated_at", `${monthStart}T00:00:00+07:00`)
    .lte("generated_at", `${monthEnd}T23:59:59+07:00`)
    .order("generated_at", { ascending: true });

  const stageTransitions = (stageTransRaw ?? []).map((s: any) => {
    const site = Array.isArray(s.site) ? s.site[0] : s.site;
    return {
      siteName: site?.name_th ?? "—",
      stageName: s.stage_name_th || s.stage_name_en || "—",
      color: s.stage_color ?? "#6366F1",
      date: s.generated_at,
    };
  });

  // Overdue projects: current stage whose target_end_date is in the past
  const { data: overdueStagesRaw } = await supabase
    .from("site_stages")
    .select("site_id, target_end_date, site:site_id(name_th)")
    .eq("owner_id", ownerId)
    .eq("is_current", true)
    .not("target_end_date", "is", null)
    .lt("target_end_date", today);

  const overdueProjects = (overdueStagesRaw ?? []).map((s: any) => {
    const site = Array.isArray(s.site) ? s.site[0] : s.site;
    const daysOverdue = Math.floor(
      (Date.now() - new Date(s.target_end_date).getTime()) / 86_400_000
    );
    return { siteId: s.site_id, siteName: site?.name_th ?? "—", targetDate: s.target_end_date, daysOverdue };
  });

  return (
    <MonthlyReportClient
      sites={sites ?? []}
      attendance={attendance ?? []}
      receipts={receipts ?? []}
      overdueProjects={overdueProjects}
      driverCash={driverCash}
      stageTransitions={stageTransitions}
      cashDifferences={cashDifferences}
      editedCount={editedCount}
      overtimeMissingCost={overtimeMissingCost}
      workers={workers ?? []}
      advances={advances}
      corrections={corrections}
      tempWorkers={tempWorkers}
      gpsIssues={gpsIssues}
      targetMonth={targetMonth}
      monthStart={monthStart}
      monthEnd={monthEnd}
      today={today}
    />
  );
}
