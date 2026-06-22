// Copyright © 2026 Workforce. All rights reserved.
// Owner-only: set or clear a site's daily note. On set, pushes the note to the
// field manager(s) who reported attendance at that site today.
import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import { sendOneSignalPush } from "@/lib/send-push";

export const dynamic = "force-dynamic";

function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export async function POST(req: NextRequest) {
  const { profile, ownerId, serviceClient } = await getAppUserContext();
  if (!profile || profile.role !== "owner" || !ownerId) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  const { site_id, note } = await req.json();
  if (!site_id || !note?.trim()) {
    return NextResponse.json({ error: "site_id and note required" }, { status: 400 });
  }

  const today = todayBangkok();

  // Confirm the site belongs to this owner before writing.
  const { data: site } = await serviceClient
    .from("sites")
    .select("id, name_th, owner_id")
    .eq("id", site_id)
    .maybeSingle();
  if (!site || site.owner_id !== ownerId) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const { data: saved, error } = await serviceClient
    .from("site_daily_notes")
    .upsert(
      {
        owner_id: ownerId,
        site_id,
        note: note.trim(),
        note_date: today,
        created_by: profile.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "site_id,note_date" }
    )
    .select("id, note")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Push to the field manager(s) who reported attendance here today.
  const { data: events } = await serviceClient
    .from("attendance_events")
    .select("reported_by")
    .eq("site_id", site_id)
    .eq("event_date", today)
    .not("reported_by", "is", null);

  const reporters = Array.from(
    new Set((events ?? []).map((e: { reported_by: string | null }) => e.reported_by).filter(Boolean) as string[])
  );

  let pushed = 0;
  if (reporters.length) {
    const r = await sendOneSignalPush({
      externalIds: reporters,
      title: `📌 ${site.name_th}`,
      body: note.trim(),
      url: `/sites/${site_id}`,
      tag: `site_note_${site_id}`,
    });
    pushed = r.sent;
  }

  return NextResponse.json({ ok: true, id: saved.id, reporters: reporters.length, pushed });
}

export async function DELETE(req: NextRequest) {
  const { profile, ownerId, serviceClient } = await getAppUserContext();
  if (!profile || profile.role !== "owner" || !ownerId) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  const { site_id } = await req.json();
  if (!site_id) {
    return NextResponse.json({ error: "site_id required" }, { status: 400 });
  }

  await serviceClient
    .from("site_daily_notes")
    .delete()
    .eq("site_id", site_id)
    .eq("owner_id", ownerId)
    .eq("note_date", todayBangkok());

  return NextResponse.json({ ok: true });
}
