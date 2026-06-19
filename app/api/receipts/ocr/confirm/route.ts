import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { ownerId, imageUrl, description, amount, merchant, date } = await req.json();
    if (!ownerId || !amount) return NextResponse.json({ ok: false });

    await supabaseAdmin.from("receipt_ocr_examples").insert({
      owner_id: ownerId,
      image_url: imageUrl ?? null,
      correct_merchant: merchant ?? null,
      correct_description: description ?? null,
      correct_amount: Number(amount),
      correct_date: date ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
