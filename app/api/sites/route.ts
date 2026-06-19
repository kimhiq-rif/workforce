// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUserContext } from "@/lib/auth-context";

export async function POST(req: NextRequest) {
  const { user, ownerId, serviceClient } = await getAppUserContext();
  if (!user || !ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name_th, name_en, location_th, location_en, project_type } = await req.json();
  if (!name_th || !name_en) {
    return NextResponse.json({ error: "Thai and English site names are required" }, { status: 400 });
  }
  const validType = project_type === "long" ? "long" : "short";

  const { data, error } = await serviceClient
    .from("sites")
    .insert({
      owner_id: ownerId,
      name_th,
      name_en,
      location_th: location_th ?? null,
      location_en: location_en ?? null,
      project_type: validType,
      status: "waiting",
      is_active: true,
    })
    .select("id, name_th, name_en, location_th, location_en, status, project_type")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const { error } = await supabase
    .from("sites")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
