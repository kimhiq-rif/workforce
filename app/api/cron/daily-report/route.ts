// Cron: 10:00 UTC = 17:00 Bangkok (Asia/Bangkok UTC+7).
// Generates daily report for each owner. Sends push with summary.
// Blocked if any receipts or wage decisions are pending.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildDailyReport } from "@/lib/daily-report";
import { generateDailyReportPdf } from "@/lib/daily-report-pdf";
import { sendOneSignalPush } from "@/lib/send-push";

export const dynamic = "force-dynamic";

function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

// owner's external_id == their users.id == ownerId.
async function sendPushToOwner(
  _supabase: ReturnType<typeof createServiceClient>,
  ownerId: string,
  title: string,
  body: string,
  url = "/"
) {
  await sendOneSignalPush({ externalIds: [ownerId], title, body, url });
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
    .createSignedUrl(path, 60 * 15);

  if (signedUrlError) return { url: null, error: signedUrlError.message };

  return { url: data.signedUrl, error: null };
}

async function sendLineMessagingDailyReport(message: string): Promise<{ sent: boolean; error?: string }> {
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

  return { sent: false, error: "LINE Messaging env vars not configured" };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }


  const supabase = createServiceClient();
  const today = todayBangkok();
  const log: string[] = [];

  const { data: existing } = await supabase
    .from("daily_report_snapshots")
    .select("id")
    .eq("report_date", today)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      date: today,
      reason: "already ran today",
    });
  }

  const { data: owners } = await supabase
    .from("users")
    .select("id")
    .eq("role", "owner");

  console.log("[daily-report] start", today, "owners:", owners?.length ?? 0);

  if (!owners?.length) {
    console.log("[daily-report] finished", new Date().toISOString());
    return NextResponse.json({ log, date: today });
  }

  for (const owner of owners) {
    try {
      const ownerId = owner.id;

      console.log("[daily-report] owner", ownerId, "building report...");
      const report = await buildDailyReport(supabase, ownerId, today);
      console.log("[daily-report] owner", ownerId, "report built, blocked:", report.isBlocked);

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
      console.log("[daily-report] owner", ownerId, "done");
      continue;
    }

    const pdf = await generateDailyReportPdf(report);
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
    const lineResult = await sendLineMessagingDailyReport(lineMessage);
    if (!lineResult.sent) {
      log.push(`owner ${ownerId} LINE Messaging skipped/error: ${lineResult.error}`);
    }

    await sendPushToOwner(
      supabase,
      ownerId,
      `📋 รายงานประจำวัน · Daily Report ${today}`,
      `👷 ${totals.totalPresent} คน · ฿${totals.totalLaborCost.toLocaleString()} ค่าแรง · ฿${totals.totalExpenses.toLocaleString()} รวม`,
      `/reports/daily?date=${today}`
    );

      log.push(`owner ${ownerId}: ${totals.totalPresent} workers, ฿${totals.totalLaborCost} labor, ฿${totals.totalExpenses} total`);
      console.log("[daily-report] owner", ownerId, "done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.push(`owner ${owner.id} UNCAUGHT ERROR: ${msg}`);
      // continue to next owner
    }
  }

  console.log("[daily-report] finished", new Date().toISOString());

  return NextResponse.json({ ok: true, date: today, log });
}
