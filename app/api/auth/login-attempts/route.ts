// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_FAILURES = 3;
const LOCK_MINUTES = 15;

type LoginAttemptAction = "check" | "failure" | "success";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function lockUntilFromNow() {
  return new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
}

function isLocked(lockedUntil: string | null | undefined) {
  return Boolean(lockedUntil && new Date(lockedUntil).getTime() > Date.now());
}

function lockedResponse(lockedUntil: string) {
  return NextResponse.json(
    {
      locked: true,
      locked_until: lockedUntil,
      message: "Account locked for 15 minutes",
    },
    { status: 423 },
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const action = body.action as LoginAttemptAction | undefined;

  if (!email || !action || !["check", "failure", "success"].includes(action)) {
    return NextResponse.json({ error: "email and valid action required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: existing, error: readError } = await supabase
    .from("login_attempts")
    .select("normalized_email, failed_count, locked_until")
    .eq("normalized_email", email)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  if (existing && isLocked(existing.locked_until)) {
    return lockedResponse(existing.locked_until);
  }

  if (action === "check") {
    return NextResponse.json({ locked: false });
  }

  if (action === "success") {
    await supabase.from("login_attempts").delete().eq("normalized_email", email);
    return NextResponse.json({ locked: false, failed_count: 0 });
  }

  const nextFailedCount = (existing?.failed_count ?? 0) + 1;
  const lockedUntil = nextFailedCount >= MAX_FAILURES ? lockUntilFromNow() : null;

  const { error: writeError } = await supabase
    .from("login_attempts")
    .upsert({
      normalized_email: email,
      failed_count: nextFailedCount,
      locked_until: lockedUntil,
      last_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "normalized_email" });

  if (writeError) {
    return NextResponse.json({ error: writeError.message }, { status: 500 });
  }

  if (lockedUntil) return lockedResponse(lockedUntil);

  return NextResponse.json({
    locked: false,
    failed_count: nextFailedCount,
    remaining_attempts: Math.max(0, MAX_FAILURES - nextFailedCount),
  });
}
