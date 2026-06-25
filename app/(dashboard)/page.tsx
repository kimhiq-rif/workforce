// Copyright © 2026 Workforce. All rights reserved.
import { getAppUserContext } from "@/lib/auth-context";
import { DashboardClient } from "@/components/screens/Dashboard/DashboardClient";
import { sitesMissingStageTarget, daysSince } from "@/lib/stage-targets";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, profile, ownerId, serviceClient: supabase } = await getAppUserContext();
  if (!user || !profile || !ownerId) redirect("/login");

  // Field Manager: go straight to their assigned site
  if (profile.role === "field_manager") {
    const { data: linkedWorker } = await supabase
      .from("workers")
      .select("assigned_site_id")
      .eq("auth_user_id", user.id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (linkedWorker?.assigned_site_id) {
      redirect(`/sites/${linkedWorker.assigned_site_id}`);
    }
  }

  // Fetch all sites with today's attendance stats
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  const { data: sites } = await supabase
    .from("sites")
    .select(`
      id, name_th, name_en, location_th, location_en, status, photo_url, project_type,
      manager:manager_id ( name_th, name_en )
    `)
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  // Fetch today's attendance counts per site (with worker name for card avatar strip)
  const { data: attendanceCounts } = await supabase
    .from("attendance_events")
    .select("site_id, status, wage_amount, arrival_time, worker:worker_id(name_th)")
    .eq("owner_id", ownerId)
    .eq("event_date", today)
    .order("arrival_time", { ascending: true, nullsFirst: false });

  // Fetch open receipts
  const { data: openReceipts } = await supabase
    .from("receipts")
    .select("id, status")
    .eq("owner_id", ownerId)
    .neq("status", "paid");

  // Fetch pending site_day_status_events
  const { data: pendingWageDecisions } = await supabase
    .from("site_day_status_events")
    .select("site_id")
    .eq("owner_id", ownerId)
    .eq("event_date", today)
    .eq("wage_decision", "pending");

  const dashboardSites = (sites ?? []).map((site) => ({
    ...site,
    manager: Array.isArray(site.manager) ? site.manager[0] ?? null : site.manager,
  }));

  const normalizedAttendance = (attendanceCounts ?? []).map((a) => ({
    ...a,
    worker: Array.isArray(a.worker) ? (a.worker[0] ?? null) : a.worker,
  }));

  // Fetch today's calendar events for mobile dashboard
  const { data: todayEvents } = await supabase
    .from("calendar_events")
    .select("id, title, event_type, event_time, is_done")
    .eq("owner_id", ownerId)
    .eq("event_date", today)
    .order("event_time", { ascending: true, nullsFirst: false });

  // Fetch the 3 nearest upcoming calendar events (today onward, not done)
  const { data: upcomingEvents } = await supabase
    .from("calendar_events")
    .select("id, title, event_type, event_date, event_time")
    .eq("owner_id", ownerId)
    .gte("event_date", today)
    .eq("is_done", false)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: false })
    .limit(3);

  // Overdue: not-done events from past dates (auto-surface in owner attention)
  const { data: overdueEvents } = await supabase
    .from("calendar_events")
    .select("id, title, event_type, event_date, event_time")
    .eq("owner_id", ownerId)
    .lt("event_date", today)
    .eq("is_done", false)
    .order("event_date", { ascending: false })
    .limit(5);

  // Owner soft-block: current stages with no target for > 7 days.
  const stageSoftBlock =
    profile.role === "owner"
      ? (await sitesMissingStageTarget(supabase, ownerId))
          .map((s) => ({
            siteId: s.siteId,
            siteNameTh: s.siteNameTh,
            siteNameEn: s.siteNameEn,
            days: daysSince(s.stageSince),
          }))
          .filter((s) => s.days >= 7)
      : [];

  return (
    <DashboardClient
      stageSoftBlock={stageSoftBlock}
      sites={dashboardSites}
      attendanceCounts={normalizedAttendance}
      openReceiptsCount={openReceipts?.length ?? 0}
      pendingQrCount={openReceipts?.filter((r) => r.status === "pending_qr").length ?? 0}
      pendingWageDecisions={pendingWageDecisions ?? []}
      today={today}
      userProfile={{ name_th: profile.name_th, name_en: profile.name_en }}
      todayEvents={todayEvents ?? []}
      upcomingEvents={upcomingEvents ?? []}
      overdueEvents={overdueEvents ?? []}
    />
  );
}
