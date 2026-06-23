import { redirect } from "next/navigation";
import { getAppUserContext } from "@/lib/auth-context";
import { todayBangkok } from "@/lib/format";
import {
  OvertimeCompletionClient,
  type OvertimeMissingRow,
} from "@/components/screens/Reports/OvertimeCompletionClient";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { month?: string };
}

export default async function MonthlyOvertimeCompletionPage({ searchParams }: Props) {
  const { profile, ownerId, serviceClient } = await getAppUserContext();
  if (!profile || !ownerId) redirect("/login");
  if (profile.role !== "owner") redirect("/reports/monthly");

  const today = todayBangkok();
  const targetMonth = searchParams.month ?? today.slice(0, 7);
  const [year, month] = targetMonth.split("-").map(Number);
  const monthStart = `${targetMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${targetMonth}-${String(lastDay).padStart(2, "0")}`;

  const { data } = await serviceClient
    .from("overtime_events")
    .select(`
      id,
      event_date,
      overtime_end_time,
      overtime_hours,
      site:site_id(name_th, name_en),
      worker:worker_id(name_th, name_en, daily_wage)
    `)
    .eq("owner_id", ownerId)
    .is("amount", null)
    .gte("event_date", monthStart)
    .lte("event_date", monthEnd)
    .order("event_date", { ascending: true });

  const rows: OvertimeMissingRow[] = (data ?? []).map((row: any) => {
    const site = Array.isArray(row.site) ? row.site[0] : row.site;
    const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
    return {
      id: row.id,
      event_date: row.event_date,
      overtime_end_time: row.overtime_end_time,
      overtime_hours: Number(row.overtime_hours ?? 0),
      siteName: site?.name_th || site?.name_en || "-",
      workerNameTh: worker?.name_th || "-",
      workerNameEn: worker?.name_en || "",
      dailyWage: Number(worker?.daily_wage ?? 0),
    };
  });

  return <OvertimeCompletionClient rows={rows} targetMonth={targetMonth} />;
}
