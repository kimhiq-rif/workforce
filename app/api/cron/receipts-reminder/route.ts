import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Find owners with unsorted receipts (pending_sorting or pending_qr)
  const { data: pendingReceipts } = await supabase
    .from("receipts")
    .select("owner_id")
    .in("status", ["pending_sorting", "pending_qr", "pending"])
    .eq("is_deleted", false)
    .throwOnError();

  if (!pendingReceipts || pendingReceipts.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const ownerIds = Array.from(new Set(pendingReceipts.map((r: { owner_id: string }) => r.owner_id)));

  // Get push subscriptions for these owners
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .in("owner_id", ownerIds)
    .throwOnError();

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  webpush.setVapidDetails(
    "mailto:admin@workforce.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: "⚠️ มีใบเสร็จรอการจัดการ · Receipts need sorting",
          body: "กรุณาจัดการใบเสร็จก่อน 17:00 · Please sort receipts before 17:00",
          url: "/suppliers",
        })
      );
      sent++;
    } catch {}
  }

  return NextResponse.json({ sent });
}
