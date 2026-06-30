// Copyright © 2026 Workforce. All rights reserved.
// Owner-only: generate a one-time magic link to log in as a team member (remote support).
import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { ownerId, profile } = await getAppUserContext();
  if (!ownerId || profile?.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { user_id } = await req.json() as { user_id: string };
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const supabase = createServiceClient();

  // Fetch the team member — must belong to this owner
  const { data: member } = await supabase
    .from("users")
    .select("id, auth_id, role")
    .eq("id", user_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!member?.auth_id) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Get their email from Supabase Auth
  const { data: authUser } = await supabase.auth.admin.getUserById(member.auth_id);
  const email = authUser?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "No email on file for this user" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? "";
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${origin}/auth/callback?next=/` },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkErr?.message ?? "Failed to generate link" }, { status: 500 });
  }

  return NextResponse.json({ access_url: linkData.properties.action_link });
}
