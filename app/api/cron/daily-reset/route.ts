// Copyright © 2026 Workforce. All rights reserved.
// Cron: 17:00 UTC = 00:00 Bangkok (Asia/Bangkok UTC+7).
// Runs at the start of each new day to prepare the system for tomorrow.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import webpush from "web-push";

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
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails("mailto:admin@workforce.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = todayBangkok();
  const tomorrow = tomorrowBangkok();
  const log: string[] = [];

  // ── 1. Update assigned_site_id for each worker based on last attendance today ──

  const { data: todayEvents } = await supabase
    .from("attendance_events")
    .select("worker_id, site_id, arrival_time")
    .eq("event_date", today)
    .order("arrival_time", { ascending: false });

  if (todayEvents?.length) {
    // Keep only the latest event per worker
    const lastSitePerWorker = new Map<string, string>();
    for (const event of todayEvents) {
      if (!lastSitePerWorker.has(event.worker_id)) {
        lastSitePerWorker.set(event.worker_id, event.site_id);
      }
    }

    for (const [workerId, siteId] of Array.from(lastSitePerWorker.entries())) {
      await supabase
        .from("workers")
        .update({ assigned_site_id: siteId })
        .eq("id", workerId);
    }
    log.push(`assigned_site updated for ${lastSitePerWorker.size} workers`);
  }

  // ── 2. Reset active site statuses to waiting ──────────────────────────────────

  const { data: activeSites } = await supabase
    .from("sites")
    .select("id, owner_id, status")
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

    // ── 5. Stage target date missing ─────────────────────────────────────────────

    const { data: sitesWithoutStageTarget } = await supabase
      .from("sites")
      .select("id, name_th")
      .eq("owner_id", ownerId)
      .eq("is_active", true)
      .eq("project_type", "long")
      .is("current_stage_target_date", null);

    if (sitesWithoutStageTarget?.length) {
      for (const s of sitesWithoutStageTarget) {
        pushQueue.push({
          title: `📅 ยังไม่กำหนดเป้าหมายขั้น`,
          body: `${s.name_th} — Set target date for current stage`,
          url: `/sites/${s.id}`,
        });
      }
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
      .in("status", ["pending_sorting", "paid_pending_sorting"]);

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
