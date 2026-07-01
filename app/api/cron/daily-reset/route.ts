// Copyright © 2026 Workforce. All rights reserved.
// Cron: 17:00 UTC = 00:00 Bangkok (Asia/Bangkok UTC+7).
// Runs at the start of each new day to prepare the system for tomorrow.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOneSignalPush } from "@/lib/send-push";
import { sitesMissingStageTarget } from "@/lib/stage-targets";

export const dynamic = "force-dynamic";

function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function tomorrowBangkok(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function lastDayOfMonth(dateStr: string): number {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(y, m, 0).getDate();
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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = todayBangkok();
  const tomorrow = tomorrowBangkok();
  const log: string[] = [];

  // ── 1. Reset active site statuses to waiting (must run before worker assignments) ──

  const { data: activeSites } = await supabase
    .from("sites")
    .select("id")
    .in("status", ["live", "rain", "half_day", "day_off"])
    .eq("is_active", true);

  if (activeSites?.length) {
    const siteIds = activeSites.map((s) => s.id);
    await supabase
      .from("sites")
      .update({ status: "waiting" })
      .in("id", siteIds);
    log.push(`reset ${activeSites.length} sites to waiting`);
  }

  // ── 2. Update assigned_site_id for each worker based on last attendance today ──

  const { data: todayEvents } = await supabase
    .from("attendance_events")
    .select("worker_id, site_id, arrival_time")
    .eq("event_date", today)
    .order("arrival_time", { ascending: false });

  if (todayEvents?.length) {
    // Keep only the latest event per worker, then batch-update via upsert on id
    const lastSitePerWorker = new Map<string, string>();
    for (const event of todayEvents) {
      if (!lastSitePerWorker.has(event.worker_id)) {
        lastSitePerWorker.set(event.worker_id, event.site_id);
      }
    }

    await Promise.all(
      Array.from(lastSitePerWorker.entries()).map(([id, assigned_site_id]) =>
        supabase.from("workers").update({ assigned_site_id }).eq("id", id)
      )
    );
    log.push(`assigned_site updated for ${lastSitePerWorker.size} workers`);
  }

  // ── 2b. Clear stale per-site daily notes (they self-expire by note_date) ─────

  const { error: noteErr } = await supabase
    .from("site_daily_notes")
    .delete()
    .lt("note_date", today);
  if (!noteErr) log.push("cleared stale site_daily_notes");

  // ── 3. Get all active owners for notification checks ─────────────────────────

  const { data: owners } = await supabase
    .from("users")
    .select("id")
    .eq("role", "owner");

  if (!owners?.length) {
    return NextResponse.json({ log, date: today });
  }

  for (const owner of owners) {
    const ownerId = owner.id;
    const pushQueue: { title: string; body: string; url: string }[] = [];

    // ── 4. Visa expiry check (workers expiring in 45 days) ──────────────────────

    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + 45);
    const thresholdStr = expiryThreshold.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

    const { data: expiringWorkers } = await supabase
      .from("workers")
      .select("id, name_th, visa_expiry_date")
      .eq("owner_id", ownerId)
      .eq("is_active", true)
      .lte("visa_expiry_date", thresholdStr)
      .gte("visa_expiry_date", tomorrow);

    if (expiringWorkers?.length) {
      for (const w of expiringWorkers) {
        pushQueue.push({
          title: `⚠️ วีซ่าหมดอายุ · Visa expiring`,
          body: `${w.name_th} — ${w.visa_expiry_date}`,
          url: `/workers`,
        });
      }
      log.push(`${expiringWorkers.length} visa expiry alerts for owner ${ownerId}`);
    }

    // ── 5. Stage target date missing (current stage has no target_end_date) ──────

    const missingTargets = await sitesMissingStageTarget(supabase, ownerId);
    for (const s of missingTargets) {
      pushQueue.push({
        title: `📅 ยังไม่กำหนดเป้าหมายขั้น`,
        body: `${s.siteNameTh} — Set target date for current stage`,
        url: `/sites/${s.siteId}`,
      });
    }

    // ── 6. Calendar reminders for tomorrow ───────────────────────────────────────

    const { data: tomorrowReminders } = await supabase
      .from("calendar_events")
      .select("id, title, reminder_time")
      .eq("owner_id", ownerId)
      .eq("event_date", tomorrow);

    if (tomorrowReminders?.length) {
      pushQueue.push({
        title: `📅 ${tomorrowReminders.length} นัดหมายพรุ่งนี้`,
        body: tomorrowReminders.map((r) => r.title).join(", "),
        url: `/calendar`,
      });
    }

    // ── 7. Pending receipts reminder ─────────────────────────────────────────────

    const { data: pendingReceipts } = await supabase
      .from("receipts")
      .select("id")
      .eq("owner_id", ownerId)
      .in("status", ["pending_sorting", "paid_pending_sorting", "pending_review", "pending", "pending_qr"]);

    if (pendingReceipts?.length) {
      pushQueue.push({
        title: `🧾 ${pendingReceipts.length} ใบเสร็จรอจัดการ`,
        body: `Pending receipts need attention · Workforce`,
        url: `/suppliers`,
      });
    }

    // ── 8. Half-month / monthly report flag ──────────────────────────────────────
    // If tomorrow is the 15th or last day of month → log so report job knows to run at 10:00

    const [ty, tm, td] = tomorrow.split("-").map(Number);
    const isPayrollDay = td === 15 || td === lastDayOfMonth(tomorrow);
    if (isPayrollDay) {
      log.push(`tomorrow ${tomorrow} is payroll day for owner ${ownerId}`);
    }

    // Send all queued pushes (fire-and-forget, non-blocking)
    for (const push of pushQueue) {
      await sendPushToOwner(supabase, ownerId, push.title, push.body, push.url);
    }
  }

  return NextResponse.json({ ok: true, date: today, log });
}
