// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { ownerId, profile } = await getAppUserContext();
  if (!ownerId || profile?.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, auth_id, role, name_th, name_en, phone, created_at")
    .eq("owner_id", ownerId)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { ownerId, profile } = await getAppUserContext();
  if (!ownerId || profile?.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { email, password, name_th, name_en, role, phone } = body as {
    email: string;
    password: string;
    name_th: string;
    name_en: string;
    role: "field_manager" | "technical_admin";
    phone?: string;
  };

  if (!email || !password || !name_th || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "Failed to create auth user" }, { status: 400 });
  }

  // Insert into users table
  const { data: member, error: dbError } = await supabase
    .from("users")
    .insert({
      auth_id: authData.user.id,
      owner_id: ownerId,
      role,
      name_th: name_th.trim(),
      name_en: (name_en ?? name_th).trim(),
      phone: phone?.trim() || null,
      session_timeout_hours: 8,
    })
    .select("id, auth_id, role, name_th, name_en, phone, created_at")
    .single();

  if (dbError) {
    // Roll back auth user if DB insert fails
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  supabase.from("audit_log").insert({
    owner_id: ownerId,
    actor_id: profile!.id,
    action: "team_member_add",
    entity_type: "user",
    entity_id: member.id,
    new_value: { role, name_th: member.name_th, name_en: member.name_en },
  }).then(() => {}, () => {});

  return NextResponse.json({ member }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { ownerId, profile } = await getAppUserContext();
  if (!ownerId || profile?.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { memberId } = await req.json();
  if (!memberId) return NextResponse.json({ error: "Missing memberId" }, { status: 400 });

  const supabase = createServiceClient();

  // Get auth_id before deleting
  const { data: member } = await supabase
    .from("users")
    .select("auth_id")
    .eq("id", memberId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Delete from users table first (cascades)
  await supabase.from("users").delete().eq("id", memberId);

  // Delete auth user
  if (member.auth_id) {
    await supabase.auth.admin.deleteUser(member.auth_id);
  }

  supabase.from("audit_log").insert({
    owner_id: ownerId,
    actor_id: profile!.id,
    action: "team_member_remove",
    entity_type: "user",
    entity_id: memberId,
  }).then(() => {}, () => {});

  return NextResponse.json({ ok: true });
}
