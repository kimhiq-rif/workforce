import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOneSignalPush } from "@/lib/send-push";

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

  // Each owner's external_id == their users.id == owner_id, so target them all.
  const ownerIds = Array.from(new Set(pendingReceipts.map((r: { owner_id: string }) => r.owner_id)));

  const { sent } = await sendOneSignalPush({
    externalIds: ownerIds,
    title: "⚠️ มีใบเสร็จรอการจัดการ · Receipts need sorting",
    body: "กรุณาจัดการใบเสร็จก่อน 17:00 · Please sort receipts before 17:00",
    url: "/suppliers",
    tag: "receipts_reminder",
  });

  return NextResponse.json({ sent });
}
