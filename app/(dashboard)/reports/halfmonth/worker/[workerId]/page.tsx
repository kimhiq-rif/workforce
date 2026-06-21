import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WorkerPeriodDetailClient } from "@/components/screens/Reports/WorkerPeriodDetailClient";
import { getHalfMonthPeriod } from "@/lib/halfmonth-report";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { workerId: string };
  searchParams: { start?: string; end?: string; date?: string };
}

export default async function WorkerPeriodPage({ params, searchParams }: PageProps) {
  const cookieStore = cookies();
  const sessionClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );

  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) redirect("/login");

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from("users").select("id, role, owner_id").eq("auth_id", user.id).single();
  if (!actor) redirect("/login");

  const ownerId = actor.role === "owner" ? actor.id : actor.owner_id;
  if (!ownerId) redirect("/");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const refDate = searchParams.date ?? today;
  const period  = getHalfMonthPeriod(refDate);
  const start   = searchParams.start ?? period.start;
  const end     = searchParams.end   ?? period.end;

  // Fetch worker + period data server-side
  const [workerRes, attRes, otRes, advRes] = await Promise.all([
    supabase.from("workers")
      .select("id, name_th, name_en, daily_wage, photo_url, role_th, role_en, site:sites(name_th, name_en)")
      .eq("id", params.workerId).eq("owner_id", ownerId).single(),
    supabase.from("attendance_events")
      .select("event_date, arrival_time, status, is_late, wage_reason, wage_amount, site_id, photo_url, site:sites(name_th)")
      .eq("worker_id", params.workerId).eq("owner_id", ownerId)
      .gte("event_date", start).lte("event_date", end)
      .order("event_date"),
    supabase.from("overtime_events")
      .select("event_date, overtime_end_time, overtime_hours, amount, site:sites(name_th)")
      .eq("worker_id", params.workerId).eq("owner_id", ownerId)
      .gte("event_date", start).lte("event_date", end).order("event_date"),
    supabase.from("advance_payments")
      .select("payment_date, amount, notes")
      .eq("worker_id", params.workerId).eq("owner_id", ownerId)
      .gte("payment_date", start).lte("payment_date", end).order("payment_date"),
  ]);

  if (!workerRes.data) redirect("/reports/halfmonth");

  const att = attRes.data ?? [];
  const ot  = otRes.data ?? [];
  const adv = advRes.data ?? [];
  const grossWage   = att.reduce((s, a) => s + Number(a.wage_amount ?? 0), 0);
  const overtimePay = ot.reduce((s, o)  => s + Number(o.amount), 0);
  const totalAdv    = adv.reduce((s, a) => s + Number(a.amount), 0);

  return (
    <WorkerPeriodDetailClient
      worker={workerRes.data as any}
      periodStart={start}
      periodEnd={end}
      attendance={att as any}
      overtime={ot as any}
      advances={adv as any}
      totals={{
        presentDays: att.filter((a) => a.status !== "missing" && a.status !== "day_off").length,
        missingDays: att.filter((a) => a.status === "missing").length,
        lateDays:    att.filter((a) => a.is_late).length,
        grossWage,
        overtimePay,
        totalAdvances: totalAdv,
        netPay: Math.max(0, grossWage + overtimePay - totalAdv),
      }}
      backUrl={`/reports/halfmonth?date=${refDate}`}
    />
  );
}
