// Copyright © 2026 Workforce. All rights reserved.
// Cron: every 30 minutes.
// Finds QR receipts that are still pending_qr more than 90 minutes after creation
// and sends a push reminder to the owner. Acts as the server-side fallback for
// the browser setTimeout in ScanClient (which fires only if the tab stays open).
// Uses tag: "qr_followup_{id}" so repeated runs collapse in OneSignal.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOneSignalPush } from "@/lib/send-push";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString();

  const { data: staleQrs } = await supabase
    .from("receipts")
    .select("id, owner_id, amount, description")
    .eq("status", "pending_qr")
    .eq("is_deleted", false)
    .lt("created_at", ninetyMinutesAgo);

  if (!staleQrs?.length) {
    return NextResponse.json({ ok: true, checked: 0, sent: 0 });
  }

  let sent = 0;
  for (const receipt of staleQrs) {
    const result = await sendOneSignalPush({
      externalIds: [receipt.owner_id],
      title: `💳 QR ยังไม่ได้ชำระ · QR still unpaid`,
      body: `${receipt.description ?? "ร้านค้า"} ฿${receipt.amount} — รอชำระ 1.5 ชม. แล้ว`,
      url: "/suppliers",
      tag: `qr_followup_${receipt.id}`,
    });
    if (result.sent > 0) sent++;
  }

  return NextResponse.json({ ok: true, checked: staleQrs.length, sent });
}
