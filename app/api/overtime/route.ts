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

export async function POST(req: NextRequest) {
  const sessionClient = getSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: actor } = await supabase
    .from("users")
    .select("id, role, owner_id")
    .eq("auth_id", user.id)
    .single();

  if (!actor || actor.role !== "owner") {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  const body = await req.json();
  const { siteId, eventDate, overtimeEndTime, entries } = body as {
    siteId: string;
    eventDate: string;
    overtimeEndTime: string; // e.g. "19:30"
    entries: { workerId: string; amount: number }[];
  };

  if (!siteId || !eventDate || !overtimeEndTime || !entries?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Compute hours from 17:00 to overtimeEndTime
  const [endH, endM] = overtimeEndTime.split(":").map(Number);
  const overtimeHours = Math.max(0, (endH - 17) + endM / 60);
  if (overtimeHours <= 0) {
    return NextResponse.json({ error: "End time must be after 17:00" }, { status: 400 });
  }

  // All entries share the same session_id
  const sessionId = crypto.randomUUID();

  const rows = entries.map(({ workerId, amount }) => ({
    owner_id: actor.id,
    site_id: siteId,
    worker_id: workerId,
    session_id: sessionId,
    event_date: eventDate,
    overtime_end_time: overtimeEndTime,
    overtime_hours: parseFloat(overtimeHours.toFixed(2)),
    amount,
    approved_by: actor.id,
  }));

  const { data, error } = await supabase
    .from("overtime_events")
    .insert(rows)
    .select("id");

  if (error) {
    console.error("overtime insert error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: data?.length ?? 0, sessionId });
}

export async function PATCH(req: NextRequest) {
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

  const body = await req.json();
  const { entries } = body as {
    entries: { id: string; amount: number }[];
  };

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "entries required" }, { status: 400 });
  }

  const cleanEntries = entries
    .map((entry) => ({
      id: entry.id,
      amount: Number(entry.amount),
    }))
    .filter((entry) => entry.id && Number.isFinite(entry.amount) && entry.amount >= 0);

  if (cleanEntries.length !== entries.length) {
    return NextResponse.json({ error: "Invalid overtime amounts" }, { status: 400 });
  }

  let updated = 0;
  for (const entry of cleanEntries) {
    const { error } = await supabase
      .from("overtime_events")
      .update({ amount: entry.amount, approved_by: actor.id })
      .eq("id", entry.id)
      .eq("owner_id", actor.id)
      .is("amount", null);

    if (error) {
      console.error("overtime update error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    updated += 1;
  }

  return NextResponse.json({ ok: true, updated });
}
