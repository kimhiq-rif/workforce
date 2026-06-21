// Cron: 03:00 UTC = 10:00 Bangkok.
// Runs on the 15th and last day of each month.
// Generates half-month payroll report, saves snapshot, sends push to owner.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildHalfMonthReport, getHalfMonthPeriod } from "@/lib/halfmonth-report";
import webpush from "web-push";

export const dynamic = "force-dynamic";

function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function isPayrollDay(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return d === 15 || d === lastDay;
}

async function sendPush(
  supabase: ReturnType<typeof createServiceClient>,
  ownerId: string,
  title: string,
  body: string,
  url = "/"
) {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("owner_id", ownerId);
  if (!subs?.length) return;
  const payload = JSON.stringify({ title, body, url });
  await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      )
    )
  );
}

export async function GET(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails("mailto:admin@workforce.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  }
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

    // Save snapshot
    await supabase
      .from("halfmonth_report_snapshots")
      .upsert({
        owner_id:      ownerId,
        period_start:  start,
        period_end:    end,
        data:          report,
        generated_at:  report.generatedAt,
        total_net_pay: report.totals.totalNetPay,
        total_workers: report.totals.totalWorkers,
      });

    const { totals } = report;

    await sendPush(
      supabase,
      ownerId,
      `💰 เงินเดือนครึ่งเดือน · Payroll ${report.periodLabel}`,
      `${totals.totalWorkers} คน · รวม ฿${totals.totalNetPay.toLocaleString()} สุทธิ · หัก ฿${totals.totalAdvances.toLocaleString()} มัดจำ`,
      `/reports/halfmonth?date=${today}`
    );

    log.push(
      `owner ${ownerId}: ${totals.totalWorkers} workers, ` +
      `gross ฿${totals.totalGross}, advances ฿${totals.totalAdvances}, net ฿${totals.totalNetPay}`
    );
  }

  return NextResponse.json({ ok: true, date: today, period: { start, end }, log });
}
