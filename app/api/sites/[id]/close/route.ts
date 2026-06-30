// Copyright © 2026 Workforce. All rights reserved.
// POST /api/sites/[id]/close
// Owner only. Verifies admin code, marks site closed_at + close_reason.
import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import bcrypt from "bcryptjs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, ownerId, profile, serviceClient } = await getAppUserContext();
  if (!user || !ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile?.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const { admin_code, close_reason } = (await req.json()) as {
    admin_code: string;
    close_reason: "completed" | "stopped_cancelled";
  };

  if (!admin_code || admin_code.length < 4)
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  if (!["completed", "stopped_cancelled"].includes(close_reason))
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });

  // Verify admin code
  const { data: owner } = await serviceClient
    .from("users")
    .select("admin_code_hash")
    .eq("id", ownerId)
    .maybeSingle();

  if (!owner?.admin_code_hash)
    return NextResponse.json({ error: "no_code_set" }, { status: 400 });

  const valid = await bcrypt.compare(admin_code, owner.admin_code_hash);
  if (!valid) return NextResponse.json({ error: "invalid_code" }, { status: 403 });

  // Load site (ownership check)
  const { data: site } = await serviceClient
    .from("sites")
    .select("id, closed_at")
    .eq("id", params.id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  if (site.closed_at) return NextResponse.json({ error: "Already closed" }, { status: 409 });

  const { error } = await serviceClient
    .from("sites")
    .update({ closed_at: new Date().toISOString(), close_reason })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
