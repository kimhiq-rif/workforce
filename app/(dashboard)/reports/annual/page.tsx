import { redirect } from "next/navigation";
import { getAppUserContext } from "@/lib/auth-context";
import { buildAnnualReport } from "@/lib/annual-report";
import { AnnualReportClient } from "@/components/screens/Reports/AnnualReportClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: {
    mode?: string;
    year?: string;
    half?: string;
  };
};

export default async function AnnualReportPage({ searchParams }: PageProps) {
  const { profile, ownerId, serviceClient } = await getAppUserContext();
  if (!profile) redirect("/login");
  if (!ownerId) redirect("/");

  const report = await buildAnnualReport(serviceClient, ownerId, {
    mode: searchParams.mode,
    year: searchParams.year,
    half: searchParams.half,
  });

  return <AnnualReportClient report={report} />;
}
