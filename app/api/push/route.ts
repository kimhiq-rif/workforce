// Copyright © 2026 Workforce. All rights reserved.
// Sends push via OneSignal REST API. Same request contract as before so all
// callers (crons, AttendanceReportFlow, DriverClient, ScanClient, SuppliersClient,
// SiteDetailClient) keep working unchanged:
//   { owner_id | user_id, title, body, url?, tag?, requireInteraction? }
// Targeting: both map to OneSignal external_id (set via OneSignal.login).
//   user_id  -> that specific user's devices
//   owner_id -> the OWNER only. owner_id == the owner's users.id, and the owner
//               logs in with external_id = their users.id, so this hits the owner
//               alone — NOT field managers / drivers under the same owner.
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ONESIGNAL_API = "https://api.onesignal.com/notifications";

export async function POST(req: NextRequest) {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !restKey) {
    return NextResponse.json({ error: "Push notifications not configured" }, { status: 503 });
  }

  const { owner_id, user_id, title, body, url, tag } = await req.json();

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (!owner_id && !user_id) {
    return NextResponse.json({ error: "owner_id or user_id required" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    app_id: appId,
    target_channel: "push",
    headings: { en: title },
    contents: { en: body ?? "" },
    url: url ?? "/",
  };

  // Collapse/replace duplicates of the same kind, mirroring the old SW `tag`.
  if (tag) payload.web_push_topic = tag;

  // user_id targets that user; owner_id targets the owner (== owner's users.id).
  payload.include_aliases = { external_id: [user_id ?? owner_id] };

  try {
    const res = await fetch(ONESIGNAL_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Key ${restKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || (Array.isArray(data?.errors) && data.errors.length)) {
      return NextResponse.json(
        { error: data?.errors ?? `OneSignal ${res.status}`, sent: 0 },
        { status: res.ok ? 502 : res.status }
      );
    }

    return NextResponse.json({ sent: data?.recipients ?? 0, id: data?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "send failed", sent: 0 }, { status: 502 });
  }
}
