import { NextRequest, NextResponse } from "next/server";
import { sendOneSignalPush } from "@/lib/send-push";
import { getAppUserContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { user: authUser, ownerId } = await getAppUserContext();
  if (!authUser || !ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workerNameTh, fromSiteNameTh, toSiteNameTh } = await req.json();

  if (!workerNameTh) {
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
