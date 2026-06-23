import { NextRequest, NextResponse } from "next/server";
import { sendOneSignalPush } from "@/lib/send-push";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { workerNameTh, fromSiteNameTh, toSiteNameTh, ownerId } = await req.json();

  if (!ownerId || !workerNameTh) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const result = await sendOneSignalPush({
    externalIds: [ownerId],
    title: `${workerNameTh} transferred / ย้ายไซต์`,
    body: `${fromSiteNameTh ?? "-"} -> ${toSiteNameTh ?? "-"}`,
    url: "/sites",
    tag: "site_transfer",
  });

  if (!result.ok && result.error === "not configured") {
    return NextResponse.json({ error: "Push notifications not configured" }, { status: 503 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error, sent: 0 }, { status: 502 });
  }

  return NextResponse.json({ sent: result.sent });
}
