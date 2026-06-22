// Copyright © 2026 Workforce. All rights reserved.
// Sends push via OneSignal REST API. Same request contract as before so all
// callers (crons, AttendanceReportFlow, DriverClient, ScanClient, SuppliersClient,
// SiteDetailClient) keep working unchanged:
//   { owner_id | user_id, title, body, url?, tag?, requireInteraction? }
// Targeting:
//   user_id  -> OneSignal external_id (set via OneSignal.login on the client)
//   owner_id -> "owner_id" tag (set via OneSignal.User.addTag on the client)
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

  if (user_id) {
    // Target a specific app user across all their devices.
    payload.include_aliases = { external_id: [user_id] };
  } else {
    // Fan out to every device tagged with this owner_id.
    payload.filters = [
      { field: "tag", key: "owner_id", relation: "=", value: owner_id },
    ];
  }

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
