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

  const { data: owners } = await supabase
    .from("users")
    .select("id")
    .eq("role", "owner");

  console.log("[daily-report] start", today, "owners:", owners?.length ?? 0);

  if (!owners?.length) {
    console.log("[daily-report] finished", new Date().toISOString());
    return NextResponse.json({ log: [], date: today });
  }

  const results = await Promise.all(
    owners.map(async (owner) => {
      const ownerId = owner.id;
      const ownerLog: string[] = [];

      try {
        // Per-owner idempotency: skip if this owner's report already ran today
        const { data: existing } = await supabase
          .from("daily_report_snapshots")
          .select("id")
          .eq("report_date", today)
          .eq("owner_id", ownerId)
          .maybeSingle();

        if (existing) {
          return `owner ${ownerId}: already ran today (skipped)`;
        }

        // ── Freeze push: sent at report-time (17:00 Bangkok) ─────────────────────
        // Warns owner the daily report is being generated now — last chance to act on pending items.
        const { data: pendingReceipts } = await supabase
          .from("receipts")
          .select("id")
          .eq("owner_id", ownerId)
          .in("status", ["pending_sorting", "pending_qr", "pending", "pending_review"])
          .eq("is_deleted", false);

        const pendingCount = pendingReceipts?.length ?? 0;
        await sendPushToOwner(
          supabase,
          ownerId,
          `🔒 הקפאה · Report generating now`,
          pendingCount > 0
            ? `⚠️ ${pendingCount} ใบเสร็จยังรอ · Daily report กำลังสร้าง`
            : `📋 Daily report กำลังสร้าง · ${today}`,
          `/reports/daily?date=${today}`
        );
        ownerLog.push(`freeze push sent (${pendingCount} pending receipts)`);

        console.log("[daily-report] owner", ownerId, "building report...");
        const report = await buildDailyReport(supabase, ownerId, today);
        console.log("[daily-report] owner", ownerId, "report built, blocked:", report.isBlocked);

        // Generate report regardless of blocking — blocked items are shown as warnings in push/LINE
        const pdf = await generateDailyReportPdf(report);
        const pdfUpload = await uploadDailyReportPdf(supabase, ownerId, today, pdf);
        if (pdfUpload.error) ownerLog.push(`pdf upload error: ${pdfUpload.error}`);

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
            is_blocked: report.isBlocked,
          });

        if (saveError) ownerLog.push(`snapshot save error: ${saveError.message}`);

        const { totals } = report;
        const pendingNote = report.isBlocked
          ? ` | ⚠️ ${report.blockReasons.length} פריטים פתוחים`
          : "";

        const lineMessage =
          `Daily Report ${today}${report.isBlocked ? " ⚠️ pending items" : ""}\n` +
          `Workers: ${totals.totalPresent} | Late: ${totals.totalLate}\n` +
          `Labor: THB ${totals.totalLaborCost.toLocaleString()} | Receipts: THB ${totals.totalReceiptAmount.toLocaleString()}\n` +
          `Total: THB ${totals.totalExpenses.toLocaleString()}` +
          (report.isBlocked ? `\n⚠️ ${report.blockReasons.map((r) => r.messageTh).join(", ")}` : "") +
          (pdfUpload.url ? `\nPDF: ${pdfUpload.url}` : "");

        const lineResult = await sendLineMessagingDailyReport(lineMessage);
        if (!lineResult.sent) ownerLog.push(`LINE skipped/error: ${lineResult.error}`);

        const pushTitle = report.isBlocked
          ? `📋 รายงานประจำวัน ⚠️ · Daily Report ${today}`
          : `📋 รายงานประจำวัน · Daily Report ${today}`;
        const pushBody = `👷 ${totals.totalPresent} คน · ฿${totals.totalLaborCost.toLocaleString()} ค่าแรง · ฿${totals.totalExpenses.toLocaleString()} รวม${pendingNote}`;

        await sendPushToOwner(supabase, ownerId, pushTitle, pushBody, `/reports/daily?date=${today}`);

        ownerLog.push(`${totals.totalPresent} workers, ฿${totals.totalLaborCost} labor, ฿${totals.totalExpenses} total${report.isBlocked ? " (blocked items present)" : ""}`);
        console.log("[daily-report] owner", ownerId, "done");
        return `owner ${ownerId}: ` + ownerLog.join("; ");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[daily-report] owner", ownerId, "UNCAUGHT ERROR:", msg);
        return `owner ${ownerId} UNCAUGHT ERROR: ${msg}`;
      }
    })
  );

  console.log("[daily-report] finished", new Date().toISOString());

  return NextResponse.json({ ok: true, date: today, log: results });
}
