import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import { buildAnnualReport } from "@/lib/annual-report";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { profile, ownerId, serviceClient } = await getAppUserContext();
  if (!profile || !ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const report = await buildAnnualReport(serviceClient, ownerId, {
    mode: searchParams.get("mode"),
    year: searchParams.get("year"),
    half: searchParams.get("half"),
  });

  return NextResponse.json(report);
}
