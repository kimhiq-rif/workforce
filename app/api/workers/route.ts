import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";

export async function POST(req: NextRequest) {
  const { user, ownerId, serviceClient } = await getAppUserContext();
  if (!user || !ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.name_th || !body.name_en) {
    return NextResponse.json({ error: "Thai and English worker names are required" }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from("workers")
    .insert({
      owner_id: ownerId,
      name_th: body.name_th,
      name_en: body.name_en,
      role_th: body.role_th || null,
      role_en: body.role_en || null,
      phone: body.phone || null,
      daily_wage: Number(body.daily_wage) || 500,
      assigned_site_id: body.assigned_site_id || null,
      is_temporary: Boolean(body.is_temporary),
      photo_url: body.photo_url || null,
      is_active: true,
    })
    .select("id, name_th, name_en, role_th, role_en, daily_wage, phone, is_temporary, is_active, assigned_site_id, site:assigned_site_id(id, name_th, name_en, status)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  serviceClient.from("audit_log").insert({
    owner_id: ownerId,
    actor_id: ownerId,
    action: "worker_add",
    entity_type: "worker",
    entity_id: data.id,
    new_value: { name_th: data.name_th, name_en: data.name_en, daily_wage: data.daily_wage },
  }).then(() => {}, () => {});

  return NextResponse.json({ data });
}
