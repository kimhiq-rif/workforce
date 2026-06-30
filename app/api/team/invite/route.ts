// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import { createServiceClient } from "@/lib/supabase/server";

function generateTempPassword(): string {
  // Readable chars — no 0/O, l/1/I confusion
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(req: NextRequest) {
  const { ownerId, profile } = await getAppUserContext();
  if (!ownerId || profile?.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { worker_id, role } = await req.json() as {
    worker_id: string;
    role: "field_manager" | "technical_admin";
  };

  if (!worker_id || !role) {
    return NextResponse.json({ error: "worker_id and role required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch worker — must belong to this owner
  const { data: worker, error: workerErr } = await supabase
    .from("workers")
    .select("id, name_th, name_en, phone, email, auth_user_id")
    .eq("id", worker_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (workerErr || !worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  if (!worker.email?.trim()) {
    return NextResponse.json({ error: "no_email" }, { status: 400 });
  }

  const email = worker.email.trim();
  const tempPassword = generateTempPassword();

  // If worker already has an auth account — reset temp password and fix role/owner_id
  if (worker.auth_user_id) {
    await supabase.from("users")
      .upsert(
        { auth_id: worker.auth_user_id, owner_id: ownerId, role, has_set_password: false,
          name_th: worker.name_th, name_en: worker.name_en, phone: worker.phone, session_timeout_hours: 8 },
        { onConflict: "auth_id" }
      );
    await supabase.auth.admin.updateUserById(worker.auth_user_id, { password: tempPassword });
    return NextResponse.json({ email, temp_password: tempPassword });
  }

  // New auth account with temp password
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authErr || !authData.user) {
    return NextResponse.json({ error: authErr?.message ?? "Failed to create auth user" }, { status: 400 });
  }

  const authUserId = authData.user.id;

  const { error: dbErr } = await supabase.from("users").insert({
    auth_id: authUserId,
    owner_id: ownerId,
    role,
    name_th: worker.name_th,
    name_en: worker.name_en,
    phone: worker.phone,
    session_timeout_hours: 8,
  });

  if (dbErr) {
    await supabase.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  await supabase.from("workers").update({ auth_user_id: authUserId }).eq("id", worker_id);

  return NextResponse.json({ email, temp_password: tempPassword });
}

export async function DELETE(req: NextRequest) {
  const { ownerId, profile } = await getAppUserContext();
  if (!ownerId || profile?.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { worker_id } = await req.json() as { worker_id: string };
  if (!worker_id) return NextResponse.json({ error: "worker_id required" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: worker } = await supabase
    .from("workers")
    .select("auth_user_id")
    .eq("id", worker_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!worker?.auth_user_id) {
    return NextResponse.json({ error: "Worker has no app account" }, { status: 404 });
  }

  await supabase.from("users").delete().eq("auth_id", worker.auth_user_id);
  await supabase.auth.admin.deleteUser(worker.auth_user_id);
  await supabase.from("workers").update({ auth_user_id: null }).eq("id", worker_id);

  return NextResponse.json({ ok: true });
}
