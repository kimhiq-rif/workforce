// Copyright © 2026 Workforce. All rights reserved.
import { createClient } from "@/lib/supabase/server";
import { CalendarClient } from "@/components/screens/Calendar/CalendarClient";
import { redirect } from "next/navigation";
import { todayBangkok } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
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

  // Get current month's day statuses
  const now = new Date(today);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  const { data: dayStatuses } = await supabase
    .from("site_day_status_events")
    .select("site_id, event_date, status, wage_decision, site:site_id(name_th)")
    .eq("owner_id", ownerId)
    .gte("event_date", monthStart)
    .lte("event_date", monthEnd)
    .order("event_date");

  // Wage totals per day
  const { data: wageByDay } = await supabase
    .from("attendance_events")
    .select("event_date, wage_amount")
    .eq("owner_id", ownerId)
    .gte("event_date", monthStart)
    .lte("event_date", monthEnd);

  return (
    <CalendarClient
      dayStatuses={dayStatuses ?? []}
      wageByDay={wageByDay ?? []}
      today={today}
      ownerId={ownerId}
    />
  );
}
