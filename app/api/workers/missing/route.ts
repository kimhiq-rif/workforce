import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getMissingStatus } from "@/lib/wage-logic";

function sessionClient() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } }
  );
}

// GET /api/workers/missing?date=YYYY-MM-DD
// Returns workers who have NOT reported today, ranked by consistency (days_worked_30d desc)
export async function GET(req: NextRequest) {
  const { data: { user } } = await sessionClient().auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from("users").select("id, role, owner_id").eq("auth_id", user.id).single();
  if (!actor || actor.role !== "owner")
    return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const ownerId = actor.id;
  const date = req.nextUrl.searchParams.get("date")
    ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  // Workers who reported today at any site
  const { data: reportedToday } = await supabase
    .from("attendance_events")
    .select("worker_id")
    .eq("owner_id", ownerId)
    .eq("event_date", date)
    .neq("status", "missing");

  const reportedIds = new Set((reportedToday ?? []).map((r) => r.worker_id));

  // All active workers + their 30-day attendance count + last date
  const { data: workers } = await supabase
    .from("worker_attendance_streak")
    .select("worker_id, owner_id, name_th, name_en, daily_wage, is_temporary, assigned_site_id, days_worked_30d, last_attendance_date")
    .eq("owner_id", ownerId);

  if (!workers) return NextResponse.json({ missing: [] });

  // Filter to those NOT reported today
  const missing = workers
    .filter((w) => !reportedIds.has(w.worker_id))
    .map((w) => ({
      workerId: w.worker_id,
      nameTh: w.name_th,
      nameEn: w.name_en,
      dailyWage: w.daily_wage,
      isTemporary: w.is_temporary,
      assignedSiteId: w.assigned_site_id,
      daysWorked30d: w.days_worked_30d,
      lastAttendanceDate: w.last_attendance_date,
      status: getMissingStatus(w.last_attendance_date, date),
    }))
    // Sort: most consistent first, then by last attendance date
    .sort((a, b) => {
      if (b.daysWorked30d !== a.daysWorked30d) return b.daysWorked30d - a.daysWorked30d;
      if (!a.lastAttendanceDate) return 1;
      if (!b.lastAttendanceDate) return -1;
      return b.lastAttendanceDate.localeCompare(a.lastAttendanceDate);
    });

  return NextResponse.json({ missing, date });
}

// POST /api/workers/missing — mark absence reason (owner only)
export async function POST(req: NextRequest) {
  const { data: { user } } = await sessionClient().auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from("users").select("id, role").eq("auth_id", user.id).single();
  if (!actor || actor.role !== "owner")
    return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const { workerId, date, reason, note } = await req.json() as {
    workerId: string;
    date: string;
    reason: "sick" | "day_off" | "family" | "other";
    note?: string;
  };

  if (!workerId || !date || !reason)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data: worker } = await supabase
    .from("workers")
    .select("assigned_site_id")
    .eq("id", workerId)
    .eq("owner_id", actor.id)
    .single();

  if (!worker?.assigned_site_id) {
    return NextResponse.json({ error: "Worker has no assigned site" }, { status: 400 });
  }

  // Upsert an attendance event with status=missing + absence_reason
  const { error } = await supabase.from("attendance_events").upsert(
    {
      owner_id: actor.id,
      site_id: worker.assigned_site_id,
      worker_id: workerId,
      event_date: date,
      status: "missing",
      absence_reason: reason,
      absence_note: note ?? null,
      absence_marked_by: actor.id,
      arrival_time: null,
      wage_amount: 0,
      wage_reason: null,
      source: "owner_manual",
    },
    { onConflict: "owner_id,worker_id,event_date,site_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
