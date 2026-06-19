// Copyright © 2026 Workforce. All rights reserved.
import { getAppUserContext } from "@/lib/auth-context";
import { SiteDetailClient } from "@/components/screens/Sites/SiteDetailClient";
import { notFound, redirect } from "next/navigation";
import { todayBangkok } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Props { params: { siteId: string } }

export default async function SiteDetailPage({ params }: Props) {
  const { user, profile, ownerId, serviceClient: supabase } = await getAppUserContext();
  if (!user || !ownerId) redirect("/login");

  // Fetch site
  const { data: site } = await supabase
    .from("sites")
    .select("*, manager:manager_id(id, name_th, name_en)")
    .eq("id", params.siteId)
    .eq("owner_id", ownerId)
    .single();

  if (!site) notFound();

  const today = todayBangkok();

  // Fetch today's attendance events with worker data
  const { data: attendanceEvents } = await supabase
    .from("attendance_events")
    .select("*, worker:worker_id(id, name_th, name_en, role_th, role_en, daily_wage, is_temporary, photo_url)")
    .eq("site_id", params.siteId)
    .eq("event_date", today)
    .order("arrival_time", { ascending: true, nullsFirst: false });

  // Fetch today's site day status event (rain/half_day etc.)
  const { data: dayStatus } = await supabase
    .from("site_day_status_events")
    .select("*")
    .eq("site_id", params.siteId)
    .eq("event_date", today)
    .maybeSingle();

  // Fetch workers assigned to this site
  const { data: workers } = await supabase
    .from("workers")
    .select("id, name_th, name_en, role_th, role_en, daily_wage, is_temporary, photo_url")
    .eq("assigned_site_id", params.siteId)
    .eq("owner_id", ownerId)
    .eq("is_active", true);

  // All active workers (for the assign-worker picker modal)
  const { data: allWorkers } = await supabase
    .from("workers")
    .select("id, name_th, name_en, role_th, role_en, daily_wage, is_temporary, photo_url")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  // Fetch other sites for the "other sites" panel
  const { data: otherSites } = await supabase
    .from("sites")
    .select("id, name_th, name_en, status")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .neq("id", params.siteId)
    .order("name_en");

  // Today's attendance across ALL sites (to detect cross-site duplicates in report flow)
  const { data: allTodayAttendance } = await supabase
    .from("attendance_events")
    .select("worker_id, site_id")
    .eq("owner_id", ownerId)
    .eq("event_date", today);

  // Yesterday's workers at this site (to show at top of report list)
  const bangkokYesterday = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  bangkokYesterday.setDate(bangkokYesterday.getDate() - 1);
  const yesterday = bangkokYesterday.toLocaleDateString("en-CA");

  const { data: yesterdayWorkerIds } = await supabase
    .from("attendance_events")
    .select("worker_id")
    .eq("site_id", params.siteId)
    .eq("event_date", yesterday);

  // Fetch today's receipts for this site
  const { data: todayReceipts } = await supabase
    .from("receipts")
    .select("id, status, amount, supplier:supplier_id(name_th, name_en)")
    .eq("owner_id", ownerId)
    .eq("site_id", params.siteId)
    .gte("created_at", `${today}T00:00:00+07:00`)
    .order("created_at", { ascending: false });

  const yesterdayWorkerIdSet = new Set((yesterdayWorkerIds ?? []).map((r) => r.worker_id));

  return (
    <SiteDetailClient
      site={site}
      attendanceEvents={attendanceEvents ?? []}
      dayStatus={dayStatus}
      workers={workers ?? []}
      allWorkers={allWorkers ?? []}
      otherSites={otherSites ?? []}
      todayReceipts={todayReceipts ?? []}
      allTodayAttendance={allTodayAttendance ?? []}
      yesterdayWorkerIds={Array.from(yesterdayWorkerIdSet)}
      today={today}
      userId={profile?.id ?? undefined}
      userRole={profile?.role ?? undefined}
    />
  );
}
