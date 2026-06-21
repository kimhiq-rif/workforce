// Cron: 10:00 UTC = 17:00 Bangkok (Asia/Bangkok UTC+7).
// Generates daily report for each owner. Sends push with summary.
// Blocked if any receipts or wage decisions are pending.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildDailyReport } from "@/lib/daily-report";
import { generateDailyReportPdf } from "@/lib/daily-report-pdf";
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

async function uploadDailyReportPdf(
  supabase: ReturnType<typeof createServiceClient>,
  ownerId: string,
  date: string,
  pdf: Buffer
): Promise<{ url: string | null; error: string | null }> {
  const bucket = process.env.DAILY_REPORTS_BUCKET || "daily-reports";
  const path = `${ownerId}/${date}/daily-report-${date}.pdf`;
  let { error } = await supabase.storage
    .from(bucket)
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });

  if (error && /bucket/i.test(error.message)) {
    await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["application/pdf"],
    });
    const retry = await supabase.storage
      .from(bucket)
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });
    error = retry.error;
  }

  if (error) return { url: null, error: error.message };

  const { data, error: signedUrlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60 * 24 * 7);

  if (signedUrlError) return { url: null, error: signedUrlError.message };

  return { url: data.signedUrl, error: null };
}

async function sendLineDailyReport(message: string): Promise<{ sent: boolean; error?: string }> {
  const notifyToken = process.env.LINE_DAILY_REPORT_NOTIFY_TOKEN || process.env.LINE_NOTIFY_TOKEN;
  if (notifyToken) {
    const form = new FormData();
    form.set("message", message);

    const res = await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: { Authorization: `Bearer ${notifyToken}` },
      body: form,
    });

    if (!res.ok) return { sent: false, error: `LINE Notify ${res.status}: ${await res.text()}` };
    return { sent: true };
  }

  const channelToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_DAILY_REPORT_TO || process.env.LINE_OWNER_USER_ID;
  if (channelToken && to) {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${channelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        messages: [{ type: "text", text: message.slice(0, 4900) }],
      }),
    });

    if (!res.ok) return { sent: false, error: `LINE Messaging ${res.status}: ${await res.text()}` };
    return { sent: true };
  }

  return { sent: false, error: "LINE env vars not configured" };
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

    const pdf = generateDailyReportPdf(report);
    const pdfUpload = await uploadDailyReportPdf(supabase, ownerId, today, pdf);
    if (pdfUpload.error) {
      log.push(`owner ${ownerId} pdf upload error: ${pdfUpload.error}`);
    }

    // Save report snapshot to DB
    const { error: saveError } = await supabase
      .from("daily_report_snapshots")
      .upsert({
        owner_id: ownerId,
        report_date: today,
        data: { ...report, pdfUrl: pdfUpload.url },
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
    const lineMessage =
      `Daily Report ${today}\n` +
      `Workers: ${totals.totalPresent} | Late: ${totals.totalLate}\n` +
      `Labor: THB ${totals.totalLaborCost.toLocaleString()} | Receipts: THB ${totals.totalReceiptAmount.toLocaleString()}\n` +
      `Total: THB ${totals.totalExpenses.toLocaleString()}` +
      (pdfUpload.url ? `\nPDF: ${pdfUpload.url}` : "");
    const lineResult = await sendLineDailyReport(lineMessage);
    if (!lineResult.sent) {
      log.push(`owner ${ownerId} LINE skipped/error: ${lineResult.error}`);
    }

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
