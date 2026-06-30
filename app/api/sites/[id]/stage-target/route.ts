import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";

// PATCH /api/sites/[id]/stage-target
// Body: { target_end_date: "YYYY-MM-DD" }
// Sets target_end_date on the current active stage

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, profile, ownerId, serviceClient } = await getAppUserContext();
  if (!user || !ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile?.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const { target_end_date } = await req.json();
  if (!target_end_date) return NextResponse.json({ error: "target_end_date required" }, { status: 400 });

  const { data: stage, error } = await serviceClient
    .from("site_stages")
    .update({ target_end_date })
    .eq("site_id", params.id)
    .eq("owner_id", ownerId)
    .eq("is_current", true)
    .select("id, name_en, target_end_date")
    .maybeSingle();

  if (error || !stage) return NextResponse.json({ error: error?.message ?? "Stage not found" }, { status: 404 });

  return NextResponse.json({ stage });
}
