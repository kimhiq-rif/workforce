// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  const { attendanceEventId, halfDayType, reason, adminCode } = await req.json();

  if (!attendanceEventId || !halfDayType || !reason?.trim() || !adminCode) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!["AM", "PM"].includes(halfDayType)) {
    return NextResponse.json({ error: "halfDayType must be AM or PM" }, { status: 400 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, owner_id, admin_code_hash")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "owner") {
    return NextResponse.json({ error: "Only owner can apply half-day corrections" }, { status: 403 });
  }
  if (!profile.admin_code_hash) {
    return NextResponse.json({ error: "No admin code set" }, { status: 400 });
  }

  const valid = await bcrypt.compare(String(adminCode), profile.admin_code_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid admin code" }, { status: 401 });
  }

  // Fetch the existing attendance event + worker daily_wage
  const { data: event } = await supabase
    .from("attendance_events")
    .select("id, worker_id, owner_id, wage_amount, wage_reason, worker:worker_id(daily_wage)")
    .eq("id", attendanceEventId)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "Attendance event not found" }, { status: 404 });
  if (event.owner_id !== profile.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const dailyWage = (event.worker as any)?.daily_wage ?? 0;
  const halfWage = Math.round(dailyWage / 2);
  const newWageReason = halfDayType === "AM" ? "half_day_am" : "half_day_pm";

  const { error: updateError } = await supabase
    .from("attendance_events")
    .update({ wage_amount: halfWage, wage_reason: newWageReason })
    .eq("id", attendanceEventId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Audit log
  await supabase.from("corrections").insert({
    owner_id: profile.id,
    entity_type: "attendance_events",
    entity_id: attendanceEventId,
    field_name: "wage_amount",
    original_value: event.wage_amount != null ? String(event.wage_amount) : null,
    corrected_value: String(halfWage),
    reason: `half_day_${halfDayType.toLowerCase()} — ${reason.trim()}`,
    corrected_by: profile.id,
    corrected_at: new Date().toISOString(),
  });

  return NextResponse.json({ wage_amount: halfWage, wage_reason: newWageReason });
}
