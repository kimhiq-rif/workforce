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
  const { data: missing, error } = await supabase
    .from("overtime_events")
    .select("owner_id, event_date")
    .is("amount", null)
    .order("event_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!missing?.length) return NextResponse.json({ ok: true, reminded: 0 });

  const byOwner = new Map<string, { count: number; firstDate: string }>();
  for (const row of missing) {
    const current = byOwner.get(row.owner_id);
    if (!current) {
      byOwner.set(row.owner_id, { count: 1, firstDate: row.event_date });
    } else {
      current.count += 1;
      if (row.event_date < current.firstDate) current.firstDate = row.event_date;
    }
  }

  let reminded = 0;
  for (const [ownerId, summary] of Array.from(byOwner.entries())) {
    const month = summary.firstDate.slice(0, 7);
    await sendOneSignalPush({
      externalIds: [ownerId],
      title: "Overtime amounts need review",
      body: `${summary.count} overtime entries still need an amount.`,
      url: `/reports/monthly/overtime?month=${month}`,
      tag: "overtime_amount_reminder",
    });
    reminded += 1;
  }

  return NextResponse.json({ ok: true, reminded, missing: missing.length });
}
