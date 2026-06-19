// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";

export async function POST(req: NextRequest) {
  const { user, ownerId, serviceClient } = await getAppUserContext();
  if (!user || !ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, event_type, event_date, event_time, site_id, notes, reminder_minutes } = body;

  if (!title || !event_date) {
    return NextResponse.json({ error: "Title and date are required" }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from("calendar_events")
    .insert({
      owner_id: ownerId,
      title,
      event_type: event_type === "meeting" ? "meeting" : "task",
      event_date,
      event_time: event_time || null,
      site_id: site_id || null,
      notes: notes || null,
      reminder_minutes: Number(reminder_minutes) || 15,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const { user, ownerId, serviceClient } = await getAppUserContext();
  if (!user || !ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, is_done } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await serviceClient
    .from("calendar_events")
    .update({ is_done })
    .eq("id", id)
    .eq("owner_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
