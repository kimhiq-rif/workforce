// Copyright © 2026 Workforce. All rights reserved.
// Project Final Report — PDF endpoint for a single site.
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase/server";
import { buildProjectFinalReport } from "@/lib/project-final-report";
import { generateProjectFinalReportPdf } from "@/lib/project-final-report-pdf";

function getSessionClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
}

export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
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

  const ownerId = actor.role === "owner" ? actor.id : actor.owner_id;
  if (!ownerId) return NextResponse.json({ error: "No owner" }, { status: 403 });

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const report = await buildProjectFinalReport(supabase, ownerId, params.siteId, today);
  if (!report) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const pdf = await generateProjectFinalReportPdf(report);
  const slug = (report.site.nameEn || report.site.nameTh || "project").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const fileName = `workforce-project-final-${slug}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
