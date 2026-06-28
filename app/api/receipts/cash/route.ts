// Copyright © 2026 Workforce. All rights reserved.
// Server-side cash receipt submission: insert + push notification in one hop.
// Moving this server-side eliminates client browser session / auth race conditions.

import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import { sendOneSignalPush } from "@/lib/send-push";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { user, profile, ownerId, serviceClient } = await getAppUserContext();
  if (!user || !profile || !ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { photo_url, photo_lat, photo_lng, site_id, amount, description, ocr_supplier_hint, site_name_th } =
    await req.json();

  if (!site_id) {
    return NextResponse.json({ error: "site_id required" }, { status: 400 });
  }

  // Insert receipt via service client (bypasses RLS, no browser session needed)
  const { data: receipt, error: dbError } = await serviceClient
    .from("receipts")
    .insert({
      owner_id: ownerId,
      submitted_by: profile.id,
      site_id,
      photo_url: photo_url ?? null,
      photo_lat: photo_lat ?? null,
      photo_lng: photo_lng ?? null,
      payment_method: "cash",
      status: "pending_review",
      amount: amount ?? null,
      description: description ?? null,
      ocr_supplier_hint: ocr_supplier_hint ?? null,
    })
    .select("id")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Push to owner — server-side, no browser session needed
  const amountLabel = amount ? ` ฿${Number(amount).toLocaleString()}` : "";
  const pushResult = await sendOneSignalPush({
    externalIds: [ownerId],
    title: "🧾 ใบเสร็จเงินสด · Cash receipt",
    body: `${profile.name_th} · ${site_name_th ?? ""}${amountLabel}`.trim(),
    url: "/suppliers",
    tag: `cash_receipt_${receipt.id}`,
  });

  return NextResponse.json({ id: receipt.id, pushSent: pushResult.sent });
}
