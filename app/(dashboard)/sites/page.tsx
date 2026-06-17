// Copyright © 2026 Workforce. All rights reserved.
import { getAppUserContext } from "@/lib/auth-context";
import { SitesClient } from "@/components/screens/Sites/SitesClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const { user, ownerId, serviceClient: supabase } = await getAppUserContext();
  if (!user || !ownerId) redirect("/login");

  const { data: sites } = await supabase
    .from("sites")
    .select("*, manager:manager_id(name_th, name_en)")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return <SitesClient sites={sites ?? []} ownerId={ownerId} />;
}
