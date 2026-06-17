// Copyright © 2026 Workforce. All rights reserved.
import { createClient } from "@/lib/supabase/server";
import { ReportsClient } from "@/components/screens/Reports/ReportsClient";
import { redirect } from "next/navigation";
import { todayBangkok } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, owner_id")
    .eq("auth_id", user.id)
    .single();

  const ownerId = profile?.role === "owner" ? profile.id : profile?.owner_id;
  const today = todayBangkok();

  // Sites with today's status for reports
  const { data: sites } = await supabase
    .from("sites")
    .select(`
      id, name_th, name_en, status, severity_score,
      manager:manager_id(name_th)
    `)
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("severity_score", { ascending: false });

  // Today's attendance + receipts counts per site
  const siteIds = (sites ?? []).map((s) => s.id);

  const [{ data: attendance }, { data: receipts }, { data: dayStatuses }] = await Promise.all([
    siteIds.length
      ? supabase
          .from("attendance_events")
          .select("site_id, status, wage_amount")
          .in("site_id", siteIds)
          .eq("event_date", today)
      : { data: [] },

    siteIds.length
      ? supabase
          .from("receipts")
          .select("site_id, amount, status")
          .in("site_id", siteIds)
          .gte("created_at", `${today}T00:00:00+07:00`)
      : { data: [] },

    siteIds.length
      ? supabase
          .from("site_day_status_events")
          .select("site_id, status, wage_decision, wage_reason, attendance_count_at_change")
          .in("site_id", siteIds)
          .eq("event_date", today)
      : { data: [] },
  ]);

  return (
    <ReportsClient
      sites={sites ?? []}
      attendance={attendance ?? []}
      receipts={receipts ?? []}
      dayStatuses={dayStatuses ?? []}
      today={today}
      ownerId={ownerId}
    />
  );
}
