// Copyright © 2026 Workforce. All rights reserved.
// POST /api/notifications/manual — owner-only manual push blast.
// Queries users by role within the owner's org and sends via OneSignal.

import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOneSignalPush } from "@/lib/send-push";

type Recipient = "owners" | "owners_managers" | "everyone";

export async function POST(req: NextRequest) {
  const { ownerId, profile } = await getAppUserContext();
  if (!ownerId || profile?.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { title, body, recipient } = (await req.json()) as {
    title: string;
    body: string;
    recipient: Recipient;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  let query = supabase.from("users").select("id").eq("owner_id", ownerId);
  if (recipient === "owners") {
    query = query.eq("role", "owner");
  } else if (recipient === "owners_managers") {
    query = query.in("role", ["owner", "field_manager"]);
  }
  // "everyone" → no additional role filter

  const { data: users, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const externalIds = (users ?? []).map((u) => u.id);
  const result = await sendOneSignalPush({
    externalIds,
    title: title.trim(),
    body: body?.trim() ?? "",
    iosSound: "chime.caf",
    androidSound: "chime",
    priority: 9,
  });

  return NextResponse.json({
    sent: result.sent,
    failed: result.ok ? 0 : externalIds.length,
  });
}
