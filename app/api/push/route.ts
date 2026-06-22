// Copyright © 2026 Workforce. All rights reserved.
// Sends push via OneSignal. Same request contract as before so all callers
// (AttendanceReportFlow, DriverClient, ScanClient, SuppliersClient,
// SiteDetailClient) keep working unchanged:
//   { owner_id | user_id, title, body, url?, tag?, requireInteraction? }
// Targeting: both map to OneSignal external_id (== users.id).
//   user_id  -> that specific user's devices
//   owner_id -> the OWNER only. owner_id == the owner's users.id, and the owner
//               logs in with external_id = their users.id, so this hits the owner
//               alone — NOT field managers / drivers under the same owner.
import { NextRequest, NextResponse } from "next/server";
import { sendOneSignalPush } from "@/lib/send-push";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { owner_id, user_id, title, body, url, tag } = await req.json();

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (!owner_id && !user_id) {
    return NextResponse.json({ error: "owner_id or user_id required" }, { status: 400 });
  }

  const result = await sendOneSignalPush({
    externalIds: [user_id ?? owner_id],
    title,
    body,
    url,
    tag,
  });

  if (!result.ok && result.error === "not configured") {
    return NextResponse.json({ error: "Push notifications not configured" }, { status: 503 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error, sent: 0 }, { status: 502 });
  }
  return NextResponse.json({ sent: result.sent });
}
