// Copyright © 2026 Workforce. All rights reserved.
// Cron: daily at 09:00 Bangkok (02:00 UTC).
// Sends push to owner for each worker whose visa expires in exactly 45 days.
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

  // Target date = today Bangkok + 45 days
  const bangkokToday = new Date(
    new Date().toLocaleString("en-CA", { timeZone: "Asia/Bangkok" })
  ).toISOString().slice(0, 10);

  const target = new Date(bangkokToday);
  target.setDate(target.getDate() + 45);
  const targetDate = target.toISOString().slice(0, 10);

  const { data: workers } = await supabase
    .from("workers")
    .select("id, name_th, name_en, owner_id, visa_expiry_date")
    .eq("visa_expiry_date", targetDate)
    .eq("is_archived", false);

  if (!workers?.length) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  for (const w of workers) {
    const result = await sendOneSignalPush({
      externalIds: [w.owner_id],
      title: `⚠️ วีซ่าใกล้หมด · Visa expiring`,
      body: `${w.name_th} · ${w.name_en} — สิ้นสุดใน 45 วัน · expires in 45 days`,
      url: `/workers`,
      tag: `visa-${w.id}`,
      priority: 9,
    });
    if (result.sent > 0) sent++;
  }

  return NextResponse.json({ ok: true, checked: workers.length, sent });
}
