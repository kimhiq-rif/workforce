// Copyright © 2026 Workforce. All rights reserved.
import { createClient } from "@/lib/supabase/server";
import { FinanceClient } from "@/components/screens/Finance/FinanceClient";
import { redirect } from "next/navigation";
import { todayBangkok } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
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

  // Today's attendance wages
  const { data: todayAttendance } = await supabase
    .from("attendance_events")
    .select("wage_amount, wage_reason, worker:worker_id(name_th, name_en, daily_wage), site:site_id(name_th)")
    .eq("owner_id", ownerId)
    .eq("event_date", today);

  // Pending receipts (not yet paid)
  const { data: pendingReceipts } = await supabase
    .from("receipts")
    .select("id, amount, category, description, supplier:supplier_id(name_th), site:site_id(name_th)")
    .eq("owner_id", ownerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  // Outstanding advances
  const { data: pendingAdvances } = await supabase
    .from("advances")
    .select("id, amount, reason, created_at, worker:worker_id(name_th, name_en)")
    .eq("owner_id", ownerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  // Past 7 days daily wage totals (for chart)
  const { data: weeklyWages } = await supabase
    .from("attendance_events")
    .select("event_date, wage_amount")
    .eq("owner_id", ownerId)
    .gte("event_date", (() => {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
    })())
    .order("event_date");

  return (
    <FinanceClient
      todayAttendance={todayAttendance ?? []}
      pendingReceipts={pendingReceipts ?? []}
      pendingAdvances={pendingAdvances ?? []}
      weeklyWages={weeklyWages ?? []}
      ownerId={ownerId}
      today={today}
    />
  );
}
