// Copyright © 2026 Workforce. All rights reserved.
import { createClient } from "@/lib/supabase/server";
import { WorkerProfileClient } from "@/components/screens/Workers/WorkerProfileClient";
import { notFound, redirect } from "next/navigation";
import { todayBangkok } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Props { params: { workerId: string } }

export default async function WorkerProfilePage({ params }: Props) {
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

  const { data: worker } = await supabase
    .from("workers")
    .select(`
      *,
      site:assigned_site_id(id, name_th, name_en, status)
    `)
    .eq("id", params.workerId)
    .eq("owner_id", ownerId)
    .single();

  if (!worker) notFound();

  // Last 30 days attendance
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  const { data: attendanceHistory } = await supabase
    .from("attendance_events")
    .select("event_date, arrival_time, status, is_late, wage_amount, wage_reason, site:site_id(name_th, name_en)")
    .eq("worker_id", params.workerId)
    .gte("event_date", fromDate)
    .order("event_date", { ascending: false });

  // Outstanding advances
  const { data: advances } = await supabase
    .from("advances")
    .select("id, amount, reason, status, created_at")
    .eq("worker_id", params.workerId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(10);

  // Sites for reassignment
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name_th, name_en")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  const normalizedWorker = {
    ...worker,
    site: Array.isArray(worker.site) ? worker.site[0] ?? null : worker.site,
  };

  const normalizedAttendanceHistory = (attendanceHistory ?? []).map((event) => ({
    ...event,
    site: Array.isArray(event.site) ? event.site[0] ?? null : event.site,
  }));

  return (
    <WorkerProfileClient
      worker={normalizedWorker}
      attendanceHistory={normalizedAttendanceHistory}
      advances={advances ?? []}
      sites={sites ?? []}
      ownerId={ownerId}
      today={today}
    />
  );
}
