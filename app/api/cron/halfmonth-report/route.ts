import { NextRequest, NextResponse } from "next/server";
import { buildHalfMonthReport, getHalfMonthPeriod } from "@/lib/halfmonth-report";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOneSignalPush } from "@/lib/send-push";

export const dynamic = "force-dynamic";

function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function isPayrollDay(dateStr: string): boolean {
  const [year, month, day] = dateStr.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return day === 15 || day === lastDay;
}

// owner's external_id == their users.id == ownerId.
async function sendPush(
  _supabase: ReturnType<typeof createServiceClient>,
  ownerId: string,
  title: string,
  body: string,
  url = "/"
) {
  await sendOneSignalPush({ externalIds: [ownerId], title, body, url });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayBangkok();

  if (!isPayrollDay(today)) {
    return NextResponse.json({ skipped: true, reason: "not a payroll day", date: today });
  }

  const supabase = createServiceClient();
  const log: string[] = [];
  const { start, end } = getHalfMonthPeriod(today);

  const { data: owners } = await supabase
    .from("users")
    .select("id")
    .eq("role", "owner");

  if (!owners?.length) return NextResponse.json({ log, date: today });

  for (const owner of owners) {
    const ownerId = owner.id;
    const report = await buildHalfMonthReport(supabase, ownerId, today);

    await supabase
      .from("halfmonth_report_snapshots")
      .upsert({
        owner_id: ownerId,
        period_start: start,
        period_end: end,
        data: report,
        generated_at: report.generatedAt,
        total_net_pay: report.totals.totalNetPay,
        total_workers: report.totals.totalWorkers,
      });

    const { totals } = report;

    await sendPush(
      supabase,
      ownerId,
      `Half-month payroll / รายงานเงินเดือนครึ่งเดือน ${report.periodLabel}`,
      `${totals.totalWorkers} workers / พนักงาน · Net THB ${totals.totalNetPay.toLocaleString()} · Advances THB ${totals.totalAdvances.toLocaleString()}`,
      `/reports/halfmonth?date=${today}`
    );

    log.push(
      `owner ${ownerId}: ${totals.totalWorkers} workers, ` +
      `gross THB ${totals.totalGross}, advances THB ${totals.totalAdvances}, net THB ${totals.totalNetPay}`
    );
  }

  return NextResponse.json({ ok: true, date: today, period: { start, end }, log });
}
