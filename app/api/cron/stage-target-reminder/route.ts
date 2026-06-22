// Copyright © 2026 Workforce. All rights reserved.
// Reminder cron: scheduled at 08:00 and 16:30 Bangkok (01:00 + 09:30 UTC).
// Pushes the owner for each active long-project site whose current stage still
// has no target_end_date. Does NOT block anything.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOneSignalPush } from "@/lib/send-push";
import { sitesMissingStageTarget } from "@/lib/stage-targets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: owners } = await supabase.from("users").select("id").eq("role", "owner");
  if (!owners?.length) return NextResponse.json({ ok: true, reminded: 0 });

  let reminded = 0;
  for (const owner of owners) {
    const missing = await sitesMissingStageTarget(supabase, owner.id);
    if (!missing.length) continue;

    const names = missing.map((s) => s.siteNameTh).join(", ");
    await sendOneSignalPush({
      externalIds: [owner.id],
      title: "📅 กำหนดเป้าหมายขั้นตอน · Set stage target",
      body:
        missing.length === 1
          ? `${names} — ยังไม่มีเป้าหมายสำหรับขั้นปัจจุบัน`
          : `${missing.length} ไซต์ยังไม่มีเป้าหมายขั้น: ${names}`,
      url: missing.length === 1 ? `/sites/${missing[0].siteId}` : "/sites",
      tag: "stage_target_reminder",
    });
    reminded += missing.length;
  }

  return NextResponse.json({ ok: true, reminded });
}
