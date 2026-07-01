import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";

export async function POST(req: NextRequest) {
  const { user, ownerId, serviceClient } = await getAppUserContext();
  if (!user || !ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.name_th || !body.name_en) {
    return NextResponse.json({ error: "Thai and English supplier names are required" }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from("suppliers")
    .insert({
      owner_id: ownerId,
      name_th: body.name_th,
      name_en: body.name_en,
      contact_phone: body.contact_phone || null,
      category: body.category || null,
      qr_code_data: body.qr_code_data || null,
      is_active: true,
    })
    .select("id, name_th, name_en, contact_phone, category, qr_code_data")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Insert returned no data" }, { status: 500 });
  return NextResponse.json({ data });
}
