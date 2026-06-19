// Copyright © 2026 Workforce. All rights reserved.
import { getAppUserContext } from "@/lib/auth-context";
import { ScanClient } from "@/components/screens/Scan/ScanClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const { user, profile, ownerId, serviceClient: supabase } = await getAppUserContext();
  if (!user || !profile || !ownerId) redirect("/login");

  // Only owner and driver manager can access scan
  if (profile.role === "field_manager") redirect("/");

  const { data: sites } = await supabase
    .from("sites")
    .select("id, name_th, name_en")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  // For driver manager: find their default assigned site
  let defaultSiteId: string | undefined;
  if (profile.role === "technical_admin") {
    const { data: worker } = await supabase
      .from("workers")
      .select("assigned_site_id")
      .eq("auth_user_id", user.id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    defaultSiteId = worker?.assigned_site_id ?? undefined;
  }

  return (
    <ScanClient
      ownerId={ownerId}
      userId={profile.id}
      sites={sites ?? []}
      defaultSiteId={defaultSiteId}
    />
  );
}
