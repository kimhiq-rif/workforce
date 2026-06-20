// Copyright © 2026 Workforce. All rights reserved.
// POST — reset a worker's password remotely, returns new temp password
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

  const { worker_id } = await req.json() as { worker_id: string };
  if (!worker_id) return NextResponse.json({ error: "worker_id required" }, { status: 400 });

  const service = createServiceClient();

  const { data: worker } = await service
    .from("workers")
    .select("auth_user_id, login_email")
    .eq("id", worker_id)
    .eq("owner_id", ownerId)
    .single();

  if (!worker?.auth_user_id) {
    return NextResponse.json({ error: "Worker has no app account" }, { status: 404 });
  }

  const tempPassword = generateTempPassword();

  const { error } = await service.auth.admin.updateUserById(worker.auth_user_id, {
    password: tempPassword,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await service.from("users")
    .update({ must_change_password: true })
    .eq("auth_id", worker.auth_user_id);

  return NextResponse.json({ temp_password: tempPassword, email: worker.login_email });
}
