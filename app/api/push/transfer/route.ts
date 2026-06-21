// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails("mailto:admin@workforce.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  }
  const { workerNameTh, fromSiteNameTh, toSiteNameTh, ownerId } = await req.json();

  if (!ownerId || !workerNameTh) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("owner_id", ownerId);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const title = `🔄 ${workerNameTh} ย้ายไซต์`;
  const body = `จาก ${fromSiteNameTh} → ${toSiteNameTh}`;
  const payload = JSON.stringify({ title, body, url: "/sites" });

  let sent = 0;
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch {}
    })
  );

  return NextResponse.json({ sent });
}
