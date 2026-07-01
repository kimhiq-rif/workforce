// POST /api/checkin/tokens
// Owner only. Generates single-use check-in tokens for selected workers.
// Returns formatted copy-paste text for WhatsApp/LINE group.

import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import { createServiceClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://workforce-git-main-armon-s-projects.vercel.app";
const TOKEN_TTL_HOURS = 6;

function generateToken(): string {
  return randomBytes(9).toString("base64url"); // 12 URL-safe chars
}

export async function POST(req: NextRequest) {
  const { profile, ownerId } = await getAppUserContext();
  if (!profile || profile.role !== "owner" || !ownerId) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  const { workerIds } = await req.json() as { workerIds: string[] };
  if (!Array.isArray(workerIds) || workerIds.length === 0) {
    return NextResponse.json({ error: "workerIds required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch workers — must be active, verified, belong to this owner
  const { data: workers, error: wErr } = await supabase
    .from("workers")
    .select("id, name_th, name_en, phone")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .eq("phone_verified", true)
    .in("id", workerIds);

  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });
  if (!workers || workers.length === 0) {
    return NextResponse.json({ error: "No verified workers found" }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

  // Build token rows
  const rows = workers.map((w) => ({
    token:      generateToken(),
    worker_id:  w.id,
    owner_id:   ownerId,
    expires_at: expiresAt,
  }));

  const { data: inserted, error: iErr } = await supabase
    .from("attendance_tokens")
    .insert(rows)
    .select("token, worker_id");

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  // Map worker_id → token for lookup
  const tokenMap = new Map((inserted ?? []).map((r) => [r.worker_id, r.token]));

  // Build copy-paste text
  const lines: string[] = [];
  for (const w of workers) {
    const tok = tokenMap.get(w.id);
    if (!tok) continue;
    const url = `${BASE_URL}/checkin/${tok}`;
    lines.push("━━━━━━━━━━━━━━━━━");
    lines.push(`👷 ${w.name_en} / ${w.name_th}`);
    lines.push(url);
  }
  lines.push("━━━━━━━━━━━━━━━━━");

  return NextResponse.json({
    count: workers.length,
    copyText: lines.join("\n"),
    tokens: (inserted ?? []).map((r) => ({
      workerId: r.worker_id,
      token: r.token,
      url: `${BASE_URL}/checkin/${r.token}`,
    })),
  });
}
