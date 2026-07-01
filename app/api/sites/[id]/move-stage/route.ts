import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";

// POST /api/sites/[id]/move-stage
// Body: { next_stage_id?: string, transition_note?: string }
// 1. Closes current stage (completed_at = now Bangkok)
// 2. Activates next stage (is_current = true)
// 3. Computes & stores stage_reports row
// 4. Returns { stage_report_id }

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, ownerId, serviceClient } = await getAppUserContext();
  if (!user || !ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const siteId = params.id;
  const { transition_note } = await req.json().catch(() => ({}));

  // ── 1. Load site ──────────────────────────────────────────────────────────
  const { data: site, error: siteErr } = await serviceClient
    .from("sites")
    .select("id, owner_id, name_en, name_th, project_type")
    .eq("id", siteId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (siteErr || !site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  if (site.project_type !== "long") {
    return NextResponse.json({ error: "Move Stage only applies to long projects" }, { status: 400 });
  }

  // ── 2. Find current stage ─────────────────────────────────────────────────
  const { data: currentStage, error: stageErr } = await serviceClient
    .from("site_stages")
    .select("*")
    .eq("site_id", siteId)
    .eq("is_current", true)
    .maybeSingle();

  if (stageErr || !currentStage) {
    return NextResponse.json({ error: "No active stage found" }, { status: 400 });
  }

  const nowBangkok = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
  );
  const stageFrom = currentStage.started_at
    ? new Date(currentStage.started_at)
    : new Date(currentStage.created_at);
  const stageTo = nowBangkok;

  // ── 3. Compute stage totals ───────────────────────────────────────────────
  const fromDate = stageFrom.toISOString().slice(0, 10);
  const toDate = stageTo.toISOString().slice(0, 10);

  const [attendanceRes, receiptRes, overtimeRes, correctionRes, gpsRes] =
    await Promise.all([
      serviceClient
        .from("attendance_events")
        .select("wage_thb, late_deduction_baht, worker_id, event_date")
        .eq("site_id", siteId)
        .eq("owner_id", ownerId)
        .gte("event_date", fromDate)
        .lte("event_date", toDate),

      serviceClient
        .from("receipt_events")
        .select("amount_thb, status, supplier_id")
        .eq("site_id", siteId)
        .eq("owner_id", ownerId)
        .gte("created_at", stageFrom.toISOString())
        .lte("created_at", stageTo.toISOString()),

      serviceClient
        .from("attendance_events")
        .select("overtime_hours, overtime_rate_thb")
        .eq("site_id", siteId)
        .eq("owner_id", ownerId)
        .gte("event_date", fromDate)
        .lte("event_date", toDate)
        .gt("overtime_hours", 0),

      serviceClient
        .from("attendance_events")
        .select("id, correction_note")
        .eq("site_id", siteId)
        .eq("owner_id", ownerId)
        .gte("event_date", fromDate)
        .lte("event_date", toDate)
        .not("correction_note", "is", null),

      serviceClient
        .from("attendance_events")
        .select("id")
        .eq("site_id", siteId)
        .eq("owner_id", ownerId)
        .gte("event_date", fromDate)
        .lte("event_date", toDate)
        .eq("gps_mismatch", true),
    ]);

  const attendance = attendanceRes.data ?? [];
  const receipts = receiptRes.data ?? [];
  const overtimes = overtimeRes.data ?? [];
  const corrections = correctionRes.data ?? [];
  const gpsIssues = gpsRes.data ?? [];

  // Work days = distinct event_dates
  const workDays = new Set(attendance.map((a) => a.event_date)).size;
  const workerCount = new Set(attendance.map((a) => a.worker_id)).size;

  const durationMs = stageTo.getTime() - stageFrom.getTime();
  const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

  const laborCost = attendance.reduce(
    (sum, a) => sum + (a.wage_thb ?? 0) - (a.late_deduction_baht ?? 0),
    0
  );
  const receiptsCost = receipts.reduce((sum, r) => sum + (r.amount_thb ?? 0), 0);
  const receiptProblems = receipts.filter((r) =>
    ["needs_review", "disputed"].includes(r.status)
  ).length;
  const overtimeCost = overtimes.reduce(
    (sum, o) => sum + (o.overtime_hours ?? 0) * (o.overtime_rate_thb ?? 0),
    0
  );
  const totalCost = laborCost + receiptsCost + overtimeCost;

  // ── 4. Build snapshot_json ────────────────────────────────────────────────
  const snapshot = {
    site: { id: siteId, name_en: site.name_en, name_th: site.name_th },
    stage: {
      id: currentStage.id,
      name_en: currentStage.name_en,
      name_th: currentStage.name_th,
      color: currentStage.color,
    },
    period: { from: fromDate, to: toDate, duration_days: durationDays, work_days: workDays },
    costs: {
      labor: laborCost,
      receipts: receiptsCost,
      overtime: overtimeCost,
      temp_workers: 0,
      total: totalCost,
    },
    counts: {
      workers: workerCount,
      corrections: corrections.length,
      gps_issues: gpsIssues.length,
      receipt_problems: receiptProblems,
      overtime_entries: overtimes.length,
    },
  };

  // ── 5. Close current stage ────────────────────────────────────────────────
  await serviceClient
    .from("site_stages")
    .update({
      is_current: false,
      completed_at: stageTo.toISOString(),
      ...(transition_note ? { transition_note } : {}),
    })
    .eq("id", currentStage.id);

  // ── 6. Activate next stage (lowest position > current) ───────────────────
  const { data: nextStage } = await serviceClient
    .from("site_stages")
    .select("id")
    .eq("site_id", siteId)
    .is("completed_at", null)
    .neq("id", currentStage.id)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextStage) {
    await serviceClient
      .from("site_stages")
      .update({ is_current: true, started_at: stageTo.toISOString() })
      .eq("id", nextStage.id);
  }

  // ── 7. Save stage report ──────────────────────────────────────────────────
  const { data: report, error: reportErr } = await serviceClient
    .from("stage_reports")
    .insert({
      owner_id: ownerId,
      site_id: siteId,
      stage_id: currentStage.id,
      stage_name_en: currentStage.name_en,
      stage_name_th: currentStage.name_th,
      stage_color: currentStage.color,
      period_from: fromDate,
      period_to: toDate,
      duration_days: durationDays,
      work_days: workDays,
      labor_cost_thb: laborCost,
      receipts_cost_thb: receiptsCost,
      temp_workers_cost_thb: 0,
      overtime_cost_thb: overtimeCost,
      total_cost_thb: totalCost,
      worker_count: workerCount,
      gps_issue_count: gpsIssues.length,
      correction_count: corrections.length,
      receipt_problem_count: receiptProblems,
      overtime_count: overtimes.length,
      temp_worker_count: 0,
      snapshot_json: snapshot,
    })
    .select("id")
    .maybeSingle();

  if (reportErr || !report) {
    return NextResponse.json({ error: "Failed to save stage report" }, { status: 500 });
  }

  return NextResponse.json({
    stage_report_id: report.id,
    next_stage_id: nextStage?.id ?? null,
    has_next_stage: !!nextStage,
  });
}
