import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { buildHalfMonthReport } from "@/lib/halfmonth-report";

function getSessionClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );
}

// GET /api/reports/halfmonth?date=2026-06-15
export async function GET(req: NextRequest) {
  const sessionClient = getSessionClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from("users")
    .select("id, role, owner_id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = actor.role === "owner" ? actor.id : actor.owner_id;
  if (!ownerId) return NextResponse.json({ error: "No owner" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ??
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  const report = await buildHalfMonthReport(supabase, ownerId, date);
  return NextResponse.json(report);
}
