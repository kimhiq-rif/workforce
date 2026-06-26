// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import { createServiceClient } from "@/lib/supabase/server";

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
  const origin = req.headers.get("origin") ?? "";

  // Fetch worker — must belong to this owner
  const { data: worker, error: workerErr } = await supabase
    .from("workers")
    .select("id, name_th, name_en, phone, email, auth_user_id")
    .eq("id", worker_id)
    .eq("owner_id", ownerId)
    .single();

  if (workerErr || !worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  const hasRealEmail = !!worker.email?.trim();

  // If worker already has an auth account, regenerate link / resend email
  if (worker.auth_user_id) {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", worker.auth_user_id)
      .single();

    if (existing) {
      await supabase.from("users").update({ role }).eq("auth_id", worker.auth_user_id);

      const { data: authUser } = await supabase.auth.admin.getUserById(worker.auth_user_id);
      const authEmail = authUser?.user?.email;

      if (authEmail) {
        if (hasRealEmail) {
          // Real email — resend invite email
          await supabase.auth.admin.inviteUserByEmail(authEmail, {
            redirectTo: `${origin}/`,
          });
          return NextResponse.json({ sent_by_email: true, email: worker.email });
        }
        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: authEmail,
          options: { redirectTo: `${origin}/` },
        });
        if (!linkErr && linkData?.properties?.action_link) {
          return NextResponse.json({ invite_url: linkData.properties.action_link });
        }
      }
    }
  }

  // New auth account
  if (hasRealEmail) {
    // Real email — use inviteUserByEmail (creates user + sends email automatically)
    const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
      worker.email!.trim(),
      { redirectTo: `${origin}/` }
    );
    if (inviteErr || !inviteData?.user) {
      return NextResponse.json({ error: inviteErr?.message ?? "Failed to send invite" }, { status: 400 });
    }
    const authUserId = inviteData.user.id;
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
    return NextResponse.json({ sent_by_email: true, email: worker.email });
  }

  // No real email — create with internal identifier + generate shareable link
  const internalEmail = `wk-${worker_id.replace(/-/g, "").slice(0, 12)}@wf.internal`;
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: internalEmail,
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
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: internalEmail,
    options: { redirectTo: `${origin}/` },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkErr?.message ?? "Failed to generate invite link" }, { status: 500 });
  }
  return NextResponse.json({ invite_url: linkData.properties.action_link });
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
    .single();

  if (!worker?.auth_user_id) {
    return NextResponse.json({ error: "Worker has no app account" }, { status: 404 });
  }

  // Delete users table entry
  await supabase.from("users").delete().eq("auth_id", worker.auth_user_id);

  // Delete auth user
  await supabase.auth.admin.deleteUser(worker.auth_user_id);

  // Unlink from worker
  await supabase.from("workers").update({ auth_user_id: null }).eq("id", worker_id);

  return NextResponse.json({ ok: true });
}
