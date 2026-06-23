// Copyright © 2026 Workforce. All rights reserved.
// Project Final Report — on-screen view with PDF download. Reachable per site.
import { redirect } from "next/navigation";
import { getAppUserContext } from "@/lib/auth-context";
import { todayBangkok } from "@/lib/format";
import { buildProjectFinalReport } from "@/lib/project-final-report";
import { ProjectFinalReportClient } from "@/components/screens/Reports/ProjectFinalReportClient";

export const dynamic = "force-dynamic";

export default async function ProjectFinalReportPage({ params }: { params: { siteId: string } }) {
  const { profile, ownerId, serviceClient } = await getAppUserContext();
  if (!profile || !ownerId) redirect("/login");
  if (profile.role !== "owner") redirect("/reports");

  const report = await buildProjectFinalReport(serviceClient, ownerId, params.siteId, todayBangkok());
  if (!report) redirect("/reports");

  return <ProjectFinalReportClient report={report} />;
}
