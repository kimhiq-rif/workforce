import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import bcrypt from "bcryptjs";

function sessionClient() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => jar.get(n)?.value } }
  );
}

// POST /api/owner/admin-code
// body: { action: "set", code: "1234" }          — set/change the admin code
//       { action: "verify", code: "1234" }        — returns { valid: true/false }
export async function POST(req: NextRequest) {
  const { data: { user } } = await sessionClient().auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from("users").select("id, role, admin_code_hash").eq("auth_id", user.id).single();
  if (!actor || actor.role !== "owner")
    return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const { action, code } = await req.json() as { action: "set" | "verify"; code: string };

  if (!code || code.length < 4)
    return NextResponse.json({ error: "Code must be at least 4 characters" }, { status: 400 });

  if (action === "set") {
    const hash = await bcrypt.hash(code, 10);
    const { error } = await supabase
      .from("users").update({ admin_code_hash: hash }).eq("id", actor.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "verify") {
    if (!actor.admin_code_hash)
      return NextResponse.json({ valid: false, reason: "no_code_set" });
    const valid = await bcrypt.compare(code, actor.admin_code_hash);
    return NextResponse.json({ valid });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
