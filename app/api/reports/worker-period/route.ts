import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getSessionClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );
}

// GET /api/reports/worker-period?workerId=...&start=...&end=...
export async function GET(req: NextRequest) {
  const sessionClient = getSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from("users").select("id, role, owner_id").eq("auth_id", user.id).maybeSingle();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = actor.role === "owner" ? actor.id : actor.owner_id;
  const { searchParams } = new URL(req.url);
  const workerId = searchParams.get("workerId");
  const start    = searchParams.get("start");
  const end      = searchParams.get("end");
  if (!workerId || !start || !end) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const [worker, attendance, overtime, advances] = await Promise.all([
    supabase.from("workers")
      .select("id, name_th, name_en, daily_wage, photo_url, role_th, role_en, site:sites(name_th, name_en)")
      .eq("id", workerId).eq("owner_id", ownerId).maybeSingle(),
    supabase.from("attendance_events")
      .select("event_date, arrival_time, status, is_late, wage_reason, wage_amount, site_id, photo_url, site:sites(name_th)")
      .eq("worker_id", workerId).eq("owner_id", ownerId)
      .gte("event_date", start).lte("event_date", end)
      .order("event_date"),
    supabase.from("overtime_events")
      .select("event_date, overtime_end_time, overtime_hours, amount, site:sites(name_th)")
      .eq("worker_id", workerId).eq("owner_id", ownerId)
      .gte("event_date", start).lte("event_date", end)
      .order("event_date"),
    supabase.from("advance_payments")
      .select("payment_date, amount, notes")
      .eq("worker_id", workerId).eq("owner_id", ownerId)
      .gte("payment_date", start).lte("payment_date", end)
      .order("payment_date"),
  ]);

  if (!worker.data) return NextResponse.json({ error: "Worker not found" }, { status: 404 });

  const att = attendance.data ?? [];
  const ot  = overtime.data ?? [];
  const adv = advances.data ?? [];

  const grossWage   = att.reduce((s, a) => s + Number(a.wage_amount ?? 0), 0);
  const overtimePay = ot.reduce((s, o) => s + Number(o.amount), 0);
  const totalAdv    = adv.reduce((s, a) => s + Number(a.amount), 0);

  return NextResponse.json({
    worker: worker.data,
    periodStart: start,
    periodEnd: end,
    attendance: att,
    overtime: ot,
    advances: adv,
    totals: {
      presentDays: att.filter((a) => a.status !== "missing" && a.status !== "day_off").length,
      missingDays: att.filter((a) => a.status === "missing").length,
      lateDays:    att.filter((a) => a.is_late).length,
      grossWage,
      overtimePay,
      totalAdvances: totalAdv,
      netPay: Math.max(0, grossWage + overtimePay - totalAdv),
    },
  });
}
