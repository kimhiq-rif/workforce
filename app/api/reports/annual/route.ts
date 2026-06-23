import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import { buildAnnualReport } from "@/lib/annual-report";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { profile, ownerId, serviceClient } = await getAppUserContext();
  if (!profile || !ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const report = await buildAnnualReport(serviceClient, ownerId, {
    mode: searchParams.get("mode"),
    year: searchParams.get("year"),
    half: searchParams.get("half"),
  });

  return NextResponse.json(report);
}

// POST — freeze the report: persist the built payload into annual_report_snapshots
// so the "big document" becomes immutable. Owner only. Upserts on the period key.
export async function POST(req: NextRequest) {
  const { profile, ownerId, serviceClient } = await getAppUserContext();
  if (!profile || !ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const report = await buildAnnualReport(serviceClient, ownerId, {
    mode: searchParams.get("mode"),
    year: searchParams.get("year"),
    half: searchParams.get("half"),
  });

  if (report.period.isPreview) {
    return NextResponse.json({ error: "Period is not complete yet — cannot freeze a preview" }, { status: 400 });
  }

  const { error } = await serviceClient
    .from("annual_report_snapshots")
    .upsert(
      {
        owner_id: ownerId,
        report_mode: report.period.mode,
        report_year: report.period.year,
        report_half: report.period.half,
        period_start: report.period.start,
        period_end: report.period.end,
        data: report,
        generated_at: report.generatedAt,
      },
      { onConflict: "owner_id,report_mode,report_year,report_half" }
    );

  if (error) {
    console.error("annual snapshot upsert error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, frozen: report.period.label });
}
