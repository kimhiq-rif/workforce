// POST /api/checkin/verify
// Public (no auth). Validates a check-in token + last 4 digits of phone.
// Returns worker info + owner's active sites on success.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { token, last4 } = await req.json() as { token: string; last4: string };

  if (!token || !last4 || last4.length !== 4 || !/^\d{4}$/.test(last4)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from("attendance_tokens")
    .select("id, worker_id, owner_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (row.used_at) {
    return NextResponse.json({ error: "already_used" }, { status: 409 });
  }

  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  // Verify last 4 digits of phone
  const { data: worker } = await supabase
    .from("workers")
    .select("id, name_th, name_en, phone")
    .eq("id", row.worker_id)
    .maybeSingle();

  if (!worker || !worker.phone) {
    return NextResponse.json({ error: "worker_not_found" }, { status: 404 });
  }

  const digitsOnly = (worker.phone as string).replace(/\D/g, "");
  if (!digitsOnly.endsWith(last4)) {
    return NextResponse.json({ error: "wrong_phone" }, { status: 401 });
  }

  // Return sites for this owner
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name_th, name_en, location_th, location_en")
    .eq("owner_id", row.owner_id)
    .eq("is_active", true)
    .order("name_th");

  return NextResponse.json({
    worker: { id: worker.id, name_th: worker.name_th, name_en: worker.name_en },
    sites: sites ?? [],
    tokenId: row.id,
  });
}
