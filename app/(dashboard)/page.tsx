// Copyright © 2026 Workforce. All rights reserved.
import { getAppUserContext } from "@/lib/auth-context";
import { DashboardClient } from "@/components/screens/Dashboard/DashboardClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, profile, ownerId, serviceClient: supabase } = await getAppUserContext();
  if (!user || !profile || !ownerId) redirect("/login");

  // Fetch all sites with today's attendance stats
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  const { data: sites } = await supabase
    .from("sites")
    .select(`
      id, name_th, name_en, location_th, location_en, status,
      manager:manager_id ( name_th, name_en )
    `)
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  // Fetch today's attendance counts per site
  const { data: attendanceCounts } = await supabase
    .from("attendance_events")
    .select("site_id, status, wage_amount")
    .eq("owner_id", ownerId)
    .eq("event_date", today);

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

  return (
    <DashboardClient
      sites={dashboardSites}
      attendanceCounts={attendanceCounts ?? []}
      openReceiptsCount={openReceipts?.length ?? 0}
      pendingQrCount={openReceipts?.filter((r) => r.status === "pending_qr").length ?? 0}
      pendingWageDecisions={pendingWageDecisions ?? []}
      today={today}
      userProfile={{ name_th: profile.name_th, name_en: profile.name_en }}
    />
  );
}
