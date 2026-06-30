import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import bcrypt from "bcryptjs";
import { computeWageAmount } from "@/lib/wage-logic";

function sessionClient() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } }
  );
}

// POST /api/attendance/half-day
// Marks an attendance event as half_day_owner_decision.
// Requires admin code verification — wage is cut, so this is a protected action.
export async function POST(req: NextRequest) {
  const { data: { user } } = await sessionClient().auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from("users")
    .select("id, role, admin_code_hash")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!actor || actor.role !== "owner")
    return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const { attendanceId, adminCode, note } = await req.json() as {
    attendanceId: string;
    adminCode: string;
    note?: string;
  };

  if (!attendanceId || !adminCode)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Verify admin code
  if (!actor.admin_code_hash)
    return NextResponse.json({ error: "no_code_set", message: "Admin code not configured in Settings" }, { status: 400 });

  const valid = await bcrypt.compare(adminCode, actor.admin_code_hash);
  if (!valid)
    return NextResponse.json({ error: "invalid_code", message: "Incorrect admin code" }, { status: 403 });

  // Fetch attendance event + worker's daily_wage
  const { data: att } = await supabase
    .from("attendance_events")
    .select("id, owner_id, worker_id, late_deduction_baht")
    .eq("id", attendanceId)
    .maybeSingle();

  if (!att || att.owner_id !== actor.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: worker } = await supabase
    .from("workers")
    .select("daily_wage")
    .eq("id", att.worker_id)
    .maybeSingle();

  const newWage = computeWageAmount(
    worker?.daily_wage ?? 0,
    "half_day_owner_decision",
    att.late_deduction_baht ?? 0
  );

  // Save as correction event in audit log, then update attendance
  const { error } = await supabase
    .from("attendance_events")
    .update({
      wage_reason: "half_day_owner_decision",
      wage_amount: newWage,
      owner_decision_verified: true,
    })
    .eq("id", attendanceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log
  await supabase.from("audit_log").insert({
    owner_id: actor.id,
    actor_id: actor.id,
    entity_type: "attendance_event",
    entity_id: attendanceId,
    action: "half_day_owner_decision",
    new_value: JSON.stringify({ wage_reason: "half_day_owner_decision", wage_amount: newWage }),
    note: note ?? "Owner marked half day with admin code verification",
  }).then(() => {}, () => {});

  return NextResponse.json({ ok: true, newWage });
}
