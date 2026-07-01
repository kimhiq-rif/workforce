// PATCH /api/workers/[id]/verify-phone
// Owner only — marks phone_verified = true (Phase 1: manual confirmation)

import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { ownerId, serviceClient: supabase, profile } = await getAppUserContext();
  if (!ownerId || profile?.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workerId = params.id;

  // Confirm worker belongs to this owner
  const { data: worker } = await supabase
    .from("workers")
    .select("id, phone")
    .eq("id", workerId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!worker.phone) return NextResponse.json({ error: "Worker has no phone number" }, { status: 400 });

  const { error } = await supabase
    .from("workers")
    .update({ phone_verified: true })
    .eq("id", workerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
