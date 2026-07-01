// POST /api/checkin/submit
// Public (no auth). Records attendance + marks token used + pushes owner.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOneSignalPush } from "@/lib/send-push";
import { randomUUID } from "crypto";

function bangkokTime(): string {
  return new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
}

function bangkokDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export async function POST(req: NextRequest) {
  const { token, site_id, photo_data, lat, lng } =
    await req.json() as {
      token: string;
      site_id: string;
      photo_data?: string; // base64 jpeg
      lat?: number;
      lng?: number;
    };

  if (!token || !site_id) {
    return NextResponse.json({ error: "token and site_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Re-validate token (prevent double-submit race)
  const { data: row } = await supabase
    .from("attendance_tokens")
    .select("id, worker_id, owner_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!row)            return NextResponse.json({ error: "not_found" },    { status: 404 });
  if (row.used_at)     return NextResponse.json({ error: "already_used" }, { status: 409 });
  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  // Upload photo if provided
  let photo_url: string | null = null;
  if (photo_data) {
    const buffer = Buffer.from(photo_data.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const filename = `${row.owner_id}/${bangkokDate()}/${row.worker_id}-${randomUUID()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("attendance-photos")
      .upload(filename, buffer, { contentType: "image/jpeg", upsert: false });
    if (!upErr) {
      const { data: signed } = await supabase.storage
        .from("attendance-photos")
        .createSignedUrl(filename, 60 * 60 * 24 * 365); // 1 year
      photo_url = signed?.signedUrl ?? null;
    }
  }

  const today       = bangkokDate();
  const arrivalTime = bangkokTime();

  // Insert attendance event
  const { error: attErr } = await supabase
    .from("attendance_events")
    .upsert({
      owner_id:    row.owner_id,
      worker_id:   row.worker_id,
      site_id,
      event_date:  today,
      arrival_time: arrivalTime,
      photo_url,
      photo_lat:   lat ?? null,
      photo_lng:   lng ?? null,
      status:      "on_site",
      is_late:     false,
      wage_reason: "full_day",
      reported_by: null, // self check-in
    }, { onConflict: "owner_id,worker_id,event_date,site_id" });

  if (attErr) return NextResponse.json({ error: attErr.message }, { status: 500 });

  // Mark token used
  await supabase
    .from("attendance_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id);

  // Fetch worker + site names for push
  const [{ data: worker }, { data: site }] = await Promise.all([
    supabase.from("workers").select("name_en, name_th").eq("id", row.worker_id).maybeSingle(),
    supabase.from("sites").select("name_th").eq("id", site_id).maybeSingle(),
  ]);

  const mapsUrl = lat && lng ? ` 📍 maps.google.com/?q=${lat},${lng}` : "";
  await sendOneSignalPush({
    externalIds: [row.owner_id],
    title: `✓ ${worker?.name_en ?? "Worker"} — ${site?.name_th ?? ""}`,
    body:  `${arrivalTime}${mapsUrl}`,
    url:   `/workers/${row.worker_id}`,
    tag:   `checkin_${row.worker_id}_${today}`,
  });

  return NextResponse.json({ ok: true });
}
