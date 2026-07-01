// Copyright © 2026 Workforce. All rights reserved.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { owner_id, supplier_id, site_id, amount, category, description, photo_url } = await req.json();

  if (!owner_id || !amount) {
    return NextResponse.json({ error: "owner_id and amount required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("receipts")
    .insert({
      owner_id,
      supplier_id: supplier_id ?? null,
      site_id: site_id ?? null,
      submitted_by: user.id,
      amount,
      category: category ?? null,
      description: description ?? null,
      photo_url: photo_url ?? null,
      receipt_number: `RC-${Date.now()}`,
      status: "pending",
    })
    .select("*, supplier:supplier_id(name_th, name_en), site:site_id(name_th, name_en)")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Insert returned no data" }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const { error } = await supabase
    .from("receipts")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null, paid_by: status === "paid" ? user.id : null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
