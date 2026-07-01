import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { buildDailyReport } from "@/lib/daily-report";
import { generateDailyReportPdf } from "@/lib/daily-report-pdf";
import { sendOneSignalPush } from "@/lib/send-push";

function getSessionClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );
}

// GET /api/reports/daily?date=2026-06-20
export async function GET(req: NextRequest) {
  const sessionClient = getSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from("users")
    .select("id, role, owner_id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = actor.role === "owner" ? actor.id : actor.owner_id;
  if (!ownerId) return NextResponse.json({ error: "No owner" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  // DEBUG: expose ownerId + raw sites count to diagnose empty report
  const { data: debugSites, error: debugSitesError } = await supabase
    .from("sites")
    .select("id, owner_id, is_active, name_th")
    .eq("owner_id", ownerId);
  const { data: debugAllSites } = await supabase
    .from("sites")
    .select("id, owner_id, is_active, name_th")
    .limit(5);

  const report = await buildDailyReport(supabase, ownerId, date);

  return NextResponse.json({
    ...report,
    _debug: {
      ownerId,
      actorRole: actor.role,
      sitesForOwner: debugSites?.length ?? 0,
      sitesForOwnerIsActive: debugSites?.filter(s => s.is_active)?.length ?? 0,
      sitesAll5: debugAllSites?.map(s => ({ id: s.id.slice(0,8), owner_id: s.owner_id?.slice(0,8), is_active: s.is_active, name: s.name_th })),
      sitesError: debugSitesError?.message ?? null,
    },
  });
}

// POST /api/reports/daily — owner-only manual trigger (same pipeline as cron)
// Body (optional): { date: "2026-07-01" }
export async function POST(req: NextRequest) {
  const sessionClient = getSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!actor || actor.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const ownerId = actor.id;
  const body = await req.json().catch(() => ({}));
  const date = body.date ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  const report = await buildDailyReport(supabase, ownerId, date);

  const pdf = await generateDailyReportPdf(report);
  const bucket = process.env.DAILY_REPORTS_BUCKET || "daily-reports";
  const pdfPath = `${ownerId}/${date}/daily-report-${date}.pdf`;
  await supabase.storage.from(bucket).upload(pdfPath, pdf, { contentType: "application/pdf", upsert: true });
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(pdfPath, 60 * 15);
  const pdfUrl = signed?.signedUrl ?? null;

  await supabase.from("daily_report_snapshots").upsert({
    owner_id: ownerId,
    report_date: date,
    data: { ...report, pdfUrl },
    generated_at: report.generatedAt,
    total_labor_cost: report.totals.totalLaborCost,
    total_expenses: report.totals.totalExpenses,
    total_present: report.totals.totalPresent,
    is_blocked: report.isBlocked,
  });

  const { totals } = report;
  const pendingNote = report.isBlocked ? ` | ⚠️ ${report.blockReasons.length} pending` : "";
  await sendOneSignalPush({
    externalIds: [ownerId],
    title: report.isBlocked ? `📋 Daily Report ${date} ⚠️` : `📋 Daily Report ${date}`,
    body: `👷 ${totals.totalPresent} คน · ฿${totals.totalLaborCost.toLocaleString()} ค่าแรง · ฿${totals.totalExpenses.toLocaleString()} รวม${pendingNote}`,
    url: `/reports/daily?date=${date}`,
  });

  return NextResponse.json({ ok: true, date, isBlocked: report.isBlocked, pdfUrl, totals });
}
