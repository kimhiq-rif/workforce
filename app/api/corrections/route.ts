// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  const {
    adminCode,
    entityType,
    entityId,
    fieldName,
    originalValue,
    correctedValue,
    reason,
  } = await req.json();

  if (!adminCode || !entityType || !entityId || !fieldName || !reason) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!reason.trim()) {
    return NextResponse.json({ error: "Reason note is required" }, { status: 400 });
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, owner_id, admin_code_hash")
    .eq("auth_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Only owner can make corrections" }, { status: 403 });
  }
  if (!profile.admin_code_hash) {
    return NextResponse.json({ error: "No admin code set" }, { status: 400 });
  }

  // Verify admin code
  const valid = await bcrypt.compare(String(adminCode), profile.admin_code_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid admin code" }, { status: 401 });
  }

  // Save correction
  const { data, error } = await supabase
    .from("corrections")
    .insert({
      owner_id: profile.id,
      entity_type: entityType,
      entity_id: entityId,
      field_name: fieldName,
      original_value: originalValue != null ? String(originalValue) : null,
      corrected_value: correctedValue != null ? String(correctedValue) : null,
      reason: reason.trim(),
      corrected_by: profile.id,
      corrected_at: new Date().toISOString(),
    })
    .select("id, corrected_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, correctedAt: data.corrected_at });
}
