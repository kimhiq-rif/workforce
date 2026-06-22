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

  // Attendance for the month
  const { data: attendance } = siteIds.length
    ? await supabase
        .from("attendance_events")
        .select("site_id, worker_id, event_date, wage_amount, status, is_late")
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

  // Workers
  const { data: workers } = siteIds.length
    ? await supabase
        .from("workers")
        .select("id, name_th, name_en, assigned_site_id, daily_wage")
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
      workers={workers ?? []}
      targetMonth={targetMonth}
      monthStart={monthStart}
      monthEnd={monthEnd}
      today={today}
    />
  );
}
