// Cron: 10:00 UTC = 17:00 Bangkok (Asia/Bangkok UTC+7).
// Generates daily report for each owner. Sends push with summary.
// Blocked if any receipts or wage decisions are pending.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildDailyReport } from "@/lib/daily-report";
import webpush from "web-push";

export const dynamic = "force-dynamic";

function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

async function sendPushToOwner(
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
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails("mailto:admin@workforce.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  }

  const supabase = createServiceClient();
  const today = todayBangkok();
  const log: string[] = [];

  const { data: owners } = await supabase
    .from("users")
    .select("id")
    .eq("role", "owner");

  if (!owners?.length) return NextResponse.json({ log, date: today });

  for (const owner of owners) {
    const ownerId = owner.id;

    const report = await buildDailyReport(supabase, ownerId, today);

    if (report.isBlocked) {
      // Notify owner that report is blocked
      const reasons = report.blockReasons.map((r) => r.messageTh).join(", ");
      await sendPushToOwner(
        supabase,
        ownerId,
        `⛔ รายงานถูกบล็อก · Daily report blocked`,
        reasons,
        `/reports/daily`
      );
      log.push(`owner ${ownerId} report BLOCKED: ${reasons}`);
      continue;
    }

    // Save report snapshot to DB
    const { error: saveError } = await supabase
      .from("daily_report_snapshots")
      .upsert({
        owner_id: ownerId,
        report_date: today,
        data: report,
        generated_at: report.generatedAt,
        total_labor_cost: report.totals.totalLaborCost,
        total_expenses: report.totals.totalExpenses,
        total_present: report.totals.totalPresent,
        is_blocked: false,
      });

    if (saveError) {
      log.push(`owner ${ownerId} snapshot save error: ${saveError.message}`);
    }

    // Push summary to owner
    const { totals } = report;
    await sendPushToOwner(
      supabase,
      ownerId,
      `📋 รายงานประจำวัน · Daily Report ${today}`,
      `👷 ${totals.totalPresent} คน · ฿${totals.totalLaborCost.toLocaleString()} ค่าแรง · ฿${totals.totalExpenses.toLocaleString()} รวม`,
      `/reports/daily?date=${today}`
    );

    log.push(`owner ${ownerId}: ${totals.totalPresent} workers, ฿${totals.totalLaborCost} labor, ฿${totals.totalExpenses} total`);
  }

  return NextResponse.json({ ok: true, date: today, log });
}
