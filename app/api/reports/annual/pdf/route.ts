// Copyright © 2026 Workforce. All rights reserved.
// Annual / Half-year report — server-rendered PDF.
import { NextRequest, NextResponse } from "next/server";
import { getAppUserContext } from "@/lib/auth-context";
import { buildAnnualReport } from "@/lib/annual-report";
import { generateAnnualReportPdf } from "@/lib/annual-report-pdf";

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

  const pdf = await generateAnnualReportPdf(report);
  const suffix = report.period.mode === "annual"
    ? `${report.period.year}`
    : `${report.period.year}-H${report.period.half}`;
  const fileName = `workforce-${report.period.mode}-report-${suffix}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
