// Copyright © 2026 Workforce. All rights reserved.
import { getAppUserContext } from "@/lib/auth-context";
import { DriverClient } from "@/components/screens/Driver/DriverClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DriverPage() {
  const { user, profile, ownerId, serviceClient: supabase } = await getAppUserContext();
  if (!user || !profile || !ownerId) redirect("/login");

  // Only technical_admin can access driver screen
  if (profile.role !== "technical_admin") redirect("/");

  // Fetch sites for the driver to pick from
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name_th, name_en, status")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  // Fetch known suppliers for OCR matching
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name_th, name_en, category, ocr_fingerprints")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  return (
    <DriverClient
      userId={profile.id}
      ownerId={ownerId}
      driverName={profile.name_th}
      sites={sites ?? []}
      suppliers={suppliers ?? []}
    />
  );
}
