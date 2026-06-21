// Copyright © 2026 Workforce. All rights reserved.
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NavigationProgress } from "@/components/layout/NavigationProgress";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <>
      <NavigationProgress />
      {children}
    </>
  );
}
