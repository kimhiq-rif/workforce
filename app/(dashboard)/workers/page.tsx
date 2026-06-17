// Copyright © 2026 Workforce. All rights reserved.
import { getAppUserContext } from "@/lib/auth-context";
import { WorkersClient } from "@/components/screens/Workers/WorkersClient";
import { redirect } from "next/navigation";
import { todayBangkok } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WorkersPage() {
  const { user, ownerId, serviceClient: supabase } = await getAppUserContext();
  if (!user || !ownerId) redirect("/login");
  const today = todayBangkok();

  const { data: workers } = await supabase
    .from("workers")
    .select(`
      id, name_th, name_en, role_th, role_en,
      daily_wage, phone, is_temporary, is_active,
      assigned_site_id,
      site:assigned_site_id(id, name_th, name_en, status)
    `)
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  // Get today's attendance for all workers
  const workerIds = (workers ?? []).map((w) => w.id);
  const { data: todayAttendance } = workerIds.length
    ? await supabase
        .from("attendance_events")
        .select("worker_id, arrival_time, status, is_late, wage_amount, wage_reason")
        .in("worker_id", workerIds)
        .eq("event_date", today)
    : { data: [] };

  // Fetch all sites for add-worker dropdown
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name_th, name_en")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  const normalizedWorkers = (workers ?? []).map((worker) => ({
    ...worker,
    site: Array.isArray(worker.site) ? worker.site[0] ?? null : worker.site,
  }));

  return (
    <WorkersClient
      workers={normalizedWorkers}
      todayAttendance={todayAttendance ?? []}
      sites={sites ?? []}
      ownerId={ownerId}
      today={today}
    />
  );
}
