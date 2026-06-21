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
  const { data: receipts } = siteIds.length
    ? await supabase
        .from("receipts")
        .select("site_id, amount, status")
        .in("site_id", siteIds)
        .gte("created_at", `${monthStart}T00:00:00+07:00`)
        .lte("created_at", `${monthEnd}T23:59:59+07:00`)
    : { data: [] };

  // Workers
  const { data: workers } = siteIds.length
    ? await supabase
        .from("workers")
        .select("id, name_th, name_en, assigned_site_id, daily_wage")
        .eq("owner_id", ownerId)
        .eq("is_active", true)
    : { data: [] };

  return (
    <MonthlyReportClient
      sites={sites ?? []}
      attendance={attendance ?? []}
      receipts={receipts ?? []}
      workers={workers ?? []}
      targetMonth={targetMonth}
      monthStart={monthStart}
      monthEnd={monthEnd}
      today={today}
    />
  );
}
