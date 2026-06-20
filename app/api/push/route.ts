// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: "Push notifications not configured" }, { status: 503 });
  }
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails("mailto:admin@workforce.app", vapidPublic, vapidPrivate);

  const supabase = createServiceClient();

  const { owner_id, user_id, title, body, url, tag, requireInteraction } = await req.json();

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (!owner_id && !user_id) {
    return NextResponse.json({ error: "owner_id or user_id required" }, { status: 400 });
  }

  // user_id targets a specific user (e.g. the driver who submitted a receipt)
  // owner_id targets all devices registered under that owner (e.g. the owner's phones)
  let query = supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (user_id) {
    query = query.eq("user_id", user_id);
  } else {
    query = query.eq("owner_id", owner_id);
  }

  const { data: subs } = await query;

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const payload = JSON.stringify({ title, body, url: url ?? "/", tag, requireInteraction });
  let sent = 0;
  const failed: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        failed.push(sub.endpoint);
      }
    })
  );

  return NextResponse.json({ sent, failed: failed.length });
}
