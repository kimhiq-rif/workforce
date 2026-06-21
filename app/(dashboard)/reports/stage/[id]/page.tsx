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
    .select(`
      *,
      sites ( name_th, name_en, project_type )
    `)
    .eq("id", params.id)
    .eq("owner_id", ownerId)
    .single();

  if (error || !report) notFound();

  return <StageReportClient report={report} />;
}
