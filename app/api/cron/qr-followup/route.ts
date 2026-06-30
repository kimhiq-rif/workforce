import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOneSignalPush } from "@/lib/send-push";
import { getAppUserContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

// Called 90 minutes after a QR is scanned — sends push to owner if still unpaid.
// Accepts CRON_SECRET bearer token (server cron) OR valid Supabase session (browser call).
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    const { user } = await getAppUserContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { receipt_id, owner_id } = await req.json();
  if (!receipt_id || !owner_id) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, status, amount, description")
    .eq("id", receipt_id)
    .maybeSingle();

  if (!receipt || receipt.status === "approved" || receipt.status === "paid") {
    return NextResponse.json({ skipped: true });
  }

  const { sent } = await sendOneSignalPush({
    externalIds: [owner_id],
    title: `💳 QR ยังไม่ได้ชำระ · QR still unpaid`,
    body: `${receipt.description ?? "ร้านค้า"} ฿${receipt.amount} — รอชำระ 1.5 ชม. แล้ว`,
    url: "/suppliers",
    tag: `qr_followup_${receipt_id}`,
  });

  return NextResponse.json({ sent });
}
