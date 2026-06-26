// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { user, profile } = await getAppUserContext();
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password } = await req.json() as { password: string };
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  await supabase
    .from("users")
    .update({ has_set_password: true })
    .eq("auth_id", user.id);

  return NextResponse.json({ ok: true });
}
