// Copyright © 2026 Workforce. All rights reserved.
// POST — create or update app access for a worker (email + auto temp-password)
import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import { createServiceClient } from "@/lib/supabase/server";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(req: NextRequest) {
  const { ownerId, profile } = await getAppUserContext();
  if (!ownerId || profile?.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { worker_id, email, role } = await req.json() as {
    worker_id: string;
    email: string;
    role: "field_manager" | "technical_admin";
  };

  if (!worker_id || !email || !role) {
    return NextResponse.json({ error: "worker_id, email and role required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify worker belongs to this owner
  const { data: worker } = await service
    .from("workers")
    .select("id, name_th, name_en, phone, auth_user_id")
    .eq("id", worker_id)
    .eq("owner_id", ownerId)
    .single();

  if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });

  const tempPassword = generateTempPassword();

  // If already has an auth account → update password + role
  if (worker.auth_user_id) {
    const { error: pwErr } = await service.auth.admin.updateUserById(worker.auth_user_id, {
      password: tempPassword,
      email,
    });
    if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 400 });

    await service.from("users")
      .update({ role, must_change_password: true })
      .eq("auth_id", worker.auth_user_id);

    await service.from("workers")
      .update({ login_email: email })
      .eq("id", worker_id);

    return NextResponse.json({ temp_password: tempPassword, email });
  }

  // Create new auth user
  const { data: authData, error: authErr } = await service.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authErr || !authData.user) {
    return NextResponse.json({ error: authErr?.message ?? "Failed to create auth user" }, { status: 400 });
  }

  const authUserId = authData.user.id;

  // Create users table entry
  const { error: dbErr } = await service.from("users").insert({
    auth_id: authUserId,
    owner_id: ownerId,
    role,
    name_th: worker.name_th,
    name_en: worker.name_en,
    phone: worker.phone,
    session_timeout_hours: 8,
    must_change_password: true,
  });

  if (dbErr) {
    await service.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  // Link auth account to worker record
  await service.from("workers")
    .update({ auth_user_id: authUserId, login_email: email })
    .eq("id", worker_id);

  return NextResponse.json({ temp_password: tempPassword, email });
}
