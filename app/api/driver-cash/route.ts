import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getSessionClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );
}

// GET /api/driver-cash?driverId=xxx&date=2026-06-20
// Returns balance for a driver on a specific date
export async function GET(req: NextRequest) {
  const sessionClient = getSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from("users")
    .select("id, role, owner_id")
    .eq("auth_id", user.id)
    .single();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get("driverId");
  const date = searchParams.get("date");
  if (!driverId || !date) return NextResponse.json({ error: "Missing driverId or date" }, { status: 400 });

  const ownerId = actor.role === "owner" ? actor.id : actor.owner_id;

  // Cash given to driver today
  const { data: entries } = await supabase
    .from("driver_cash_entries")
    .select("id, amount, notes, created_at")
    .eq("owner_id", ownerId)
    .eq("driver_id", driverId)
    .eq("entry_date", date)
    .order("created_at", { ascending: true });

  const totalGiven = (entries ?? []).reduce((s, e) => s + Number(e.amount), 0);

  // Cash receipts paid by this driver today
  const { data: cashReceipts } = await supabase
    .from("receipts")
    .select("id, amount, supplier:suppliers(name_th)")
    .eq("owner_id", ownerId)
    .eq("driver_id", driverId)
    .eq("paid_from_driver_cash", true)
    .eq("receipt_date", date);

  const totalSpent = (cashReceipts ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const balance = totalGiven - totalSpent;

  return NextResponse.json({
    driverId,
    date,
    totalGiven,
    totalSpent,
    balance,
    entries: entries ?? [],
    cashReceipts: cashReceipts ?? [],
  });
}

// POST /api/driver-cash — owner adds cash to driver
export async function POST(req: NextRequest) {
  const sessionClient = getSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!actor || actor.role !== "owner") {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  const { driverId, amount, date, notes } = await req.json();
  if (!driverId || !amount || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (Number(amount) <= 0) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("driver_cash_entries")
    .insert({
      owner_id: actor.id,
      driver_id: driverId,
      entry_date: date,
      amount: Number(amount),
      given_by: actor.id,
      notes: notes ?? null,
    })
    .select("id, amount, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, entry: data });
}
