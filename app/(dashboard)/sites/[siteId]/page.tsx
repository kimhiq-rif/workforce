// Copyright © 2026 Workforce. All rights reserved.
import { createClient } from "@/lib/supabase/server";
import { SiteDetailClient } from "@/components/screens/Sites/SiteDetailClient";
import { notFound, redirect } from "next/navigation";
import { todayBangkok } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Props { params: { siteId: string } }

export default async function SiteDetailPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, owner_id")
    .eq("auth_id", user.id)
    .single();

  const ownerId = profile?.role === "owner" ? profile.id : profile?.owner_id;

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

  // Fetch other sites for the "other sites" panel
  const { data: otherSites } = await supabase
    .from("sites")
    .select("id, name_th, name_en, status")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .neq("id", params.siteId)
    .order("name_en");

  // Fetch today's receipts for this site
  const { data: todayReceipts } = await supabase
    .from("receipts")
    .select("id, status, amount, supplier:supplier_id(name_th, name_en)")
    .eq("owner_id", ownerId)
    .eq("site_id", params.siteId)
    .gte("created_at", `${today}T00:00:00+07:00`)
    .order("created_at", { ascending: false });

  return (
    <SiteDetailClient
      site={site}
      attendanceEvents={attendanceEvents ?? []}
      dayStatus={dayStatus}
      workers={workers ?? []}
      otherSites={otherSites ?? []}
      todayReceipts={todayReceipts ?? []}
      today={today}
      userId={profile?.id}
      userRole={profile?.role}
    />
  );
}
