import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

// Called 90 minutes after a QR is scanned — sends push to owner if still unpaid
export async function POST(req: Request) {
  const { receipt_id, owner_id } = await req.json();
  if (!receipt_id || !owner_id) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, status, amount, description")
    .eq("id", receipt_id)
    .single();

  if (!receipt || receipt.status === "approved" || receipt.status === "paid") {
    return NextResponse.json({ skipped: true });
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("owner_id", owner_id);

  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 });

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
          title: `💳 QR ยังไม่ได้ชำระ · QR still unpaid`,
          body: `${receipt.description ?? "ร้านค้า"} ฿${receipt.amount} — รอชำระ 1.5 ชม. แล้ว`,
          url: "/suppliers",
        })
      );
      sent++;
    } catch {}
  }

  return NextResponse.json({ sent });
}
