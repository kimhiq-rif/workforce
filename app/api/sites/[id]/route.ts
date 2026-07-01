// PATCH /api/sites/[id]
// Owner only — update site name (name_th, name_en)

import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { ownerId, serviceClient: supabase, profile } = await getAppUserContext();
  if (!ownerId || profile?.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name_th, name_en } = await req.json() as { name_th?: string; name_en?: string };
  if (!name_th?.trim()) {
    return NextResponse.json({ error: "Thai name required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("sites")
    .update({ name_th: name_th.trim(), name_en: name_en?.trim() || name_th.trim() })
    .eq("id", params.id)
    .eq("owner_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
