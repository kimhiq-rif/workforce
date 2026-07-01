import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buildDailyReport } from "@/lib/daily-report";
import { DailyReportClient } from "@/components/screens/Reports/DailyReportClient";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { date?: string };
}

export default async function DailyReportPage({ searchParams }: PageProps) {
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
    .from("users")
    .select("id, role, owner_id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!actor) redirect("/login");

  const ownerId = actor.role === "owner" ? actor.id : actor.owner_id;
  if (!ownerId) redirect("/");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const date = searchParams.date ?? today;

  const report = await buildDailyReport(supabase, ownerId, date);

  return <DailyReportClient report={report} today={today} />;
}
