// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeAttendanceWageReason, computeWageAmount } from "@/lib/wage-logic";
import { todayBangkok, nowBangkok } from "@/lib/format";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { worker_id, site_id, photo_url, lat, lng } = await req.json();

  if (!worker_id || !site_id) {
    return NextResponse.json({ error: "worker_id and site_id required" }, { status: 400 });
  }

  const { data: worker } = await supabase
    .from("workers")
    .select("id, daily_wage, owner_id")
    .eq("id", worker_id)
    .single();

  if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });

  const { data: site } = await supabase
    .from("sites")
    .select("id, status, owner_id")
    .eq("id", site_id)
    .single();

  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const today = todayBangkok();
  const arrivalTime = nowBangkok();
  const workdayStart = "08:00";
  const isLate = arrivalTime > workdayStart;

  const wageReason = computeAttendanceWageReason(arrivalTime, site.status);
  const wageAmount = wageReason ? computeWageAmount(worker.daily_wage, wageReason) : 0;

  const { data, error } = await supabase
    .from("attendance_events")
    .upsert({
      owner_id: worker.owner_id,
      site_id,
      worker_id,
      reported_by: user.id,
      event_date: today,
      arrival_time: arrivalTime,
      photo_url: photo_url ?? null,
      photo_lat: lat ?? null,
      photo_lng: lng ?? null,
      status: isLate ? "late" : "on_site",
      is_late: isLate,
      wage_reason: wageReason,
      wage_amount: wageAmount,
    }, { onConflict: "worker_id,event_date,site_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
