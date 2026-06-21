// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";

type Decision = "half_day" | "full_day" | "no_wage" | "ask_17";

const DECISION_MAP: Record<Decision, { wage_decision: string; wage_reason: string }> = {
  half_day: { wage_decision: "half_day",  wage_reason: "half_day_rain" },
  full_day: { wage_decision: "full_day",  wage_reason: "full_day" },
  no_wage:  { wage_decision: "none",      wage_reason: "no_pay_rain_before_attendance" },
  ask_17:   { wage_decision: "pending",   wage_reason: "pending_owner_decision" },
};

export async function POST(req: NextRequest) {
  const { profile, ownerId, serviceClient } = await getAppUserContext();
  if (!profile || profile.role !== "owner") {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  const body = await req.json();
  const { siteId, decision } = body as { siteId: string; decision: Decision };

  if (!siteId || !decision || !DECISION_MAP[decision]) {
    return NextResponse.json({ error: "siteId and valid decision required" }, { status: 400 });
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const mapped = DECISION_MAP[decision];

  // Update the site_day_status_events record
  const { error: statusError } = await serviceClient
    .from("site_day_status_events")
    .update({
      wage_decision: mapped.wage_decision,
      wage_reason: mapped.wage_reason,
      wage_decided_at: new Date().toISOString(),
      wage_decided_by: profile.id,
    })
    .eq("owner_id", ownerId)
    .eq("site_id", siteId)
    .eq("event_date", today);

  if (statusError) {
    return NextResponse.json({ error: statusError.message }, { status: 500 });
  }

  // If a real decision (not ask_17), update attendance_events wage amounts
  if (decision !== "ask_17") {
    const { data: events } = await serviceClient
      .from("attendance_events")
      .select("id, worker_id")
      .eq("owner_id", ownerId)
      .eq("site_id", siteId)
      .eq("event_date", today)
      .neq("status", "missing");

    if (events && events.length > 0) {
      const workerIds = events.map((e) => e.worker_id);
      const { data: workers } = await serviceClient
        .from("workers")
        .select("id, daily_wage")
        .in("id", workerIds);

      const wageMap = Object.fromEntries((workers ?? []).map((w) => [w.id, w.daily_wage as number]));

      await Promise.all(
        events.map((e) => {
          const daily = wageMap[e.worker_id] ?? 0;
          const wageAmount =
            decision === "half_day" ? daily / 2 :
            decision === "no_wage"  ? 0 :
            daily; // full_day

          return serviceClient
            .from("attendance_events")
            .update({ wage_reason: mapped.wage_reason, wage_amount: wageAmount })
            .eq("id", e.id);
        })
      );
    }
  }

  return NextResponse.json({ ok: true });
}
