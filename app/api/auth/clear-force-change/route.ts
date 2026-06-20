// Copyright © 2026 Workforce. All rights reserved.
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  await service.from("users").update({ must_change_password: false }).eq("auth_id", user.id);

  return NextResponse.json({ ok: true });
}
