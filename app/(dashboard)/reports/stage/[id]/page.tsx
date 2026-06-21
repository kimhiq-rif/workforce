import { notFound } from "next/navigation";
import { getAppUserContext } from "@/lib/auth-context";
import StageReportClient from "./StageReportClient";

export default async function StageReportPage({
  params,
}: {
  params: { id: string };
}) {
  const { ownerId, serviceClient } = await getAppUserContext();
  if (!ownerId) notFound();

  const { data: report, error } = await serviceClient
    .from("stage_reports")
    .select(`*, sites ( name_th, name_en, project_type )`)
    .eq("id", params.id)
    .eq("owner_id", ownerId)
    .single();

  if (error || !report) notFound();

  // Check if there's a next active stage and whether it has a target date
  const { data: nextStage } = await serviceClient
    .from("site_stages")
    .select("id, target_end_date")
    .eq("site_id", report.site_id)
    .eq("is_current", true)
    .maybeSingle();

  return (
    <StageReportClient
      report={report}
      nextStageId={nextStage?.id ?? null}
      nextStageHasTarget={!!nextStage?.target_end_date}
    />
  );
}
