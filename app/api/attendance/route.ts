// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  computeAttendanceWageReason,
  computeWageAmount,
  computeLateDeduction,
} from "@/lib/wage-logic";
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
    .select("id, daily_wage, owner_id, is_temporary")
    .eq("id", worker_id)
    .maybeSingle();

  if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });

  const { data: site } = await supabase
    .from("sites")
    .select("id, status, owner_id")
    .eq("id", site_id)
    .maybeSingle();

  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  if (worker.owner_id !== site.owner_id) {
    return NextResponse.json({ error: "Worker and site belong to different accounts" }, { status: 403 });
  }

  const today       = todayBangkok();
  const arrivalTime = nowBangkok();

  const wageReason        = computeAttendanceWageReason(arrivalTime, site.status);
  const lateDeductionBaht = wageReason
    ? computeLateDeduction(arrivalTime, wageReason, worker.is_temporary ?? false)
    : 0;
  const wageAmount = wageReason
    ? computeWageAmount(worker.daily_wage, wageReason, lateDeductionBaht)
    : 0;
  const isLate = lateDeductionBaht > 0;

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
      late_deduction_baht: lateDeductionBaht,
    }, { onConflict: "owner_id,worker_id,event_date,site_id" })
    .select()
    .maybeSingle();

  if (!data && !error) {
    return NextResponse.json({ error: "Upsert returned no data" }, { status: 500 });
  }
  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  return NextResponse.json({ data });
}
