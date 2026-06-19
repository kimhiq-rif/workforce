// Copyright © 2026 Workforce. All rights reserved.
import { getAppUserContext } from "@/lib/auth-context";
import { SettingsClient } from "@/components/screens/Settings/SettingsClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, profile, ownerId, serviceClient: supabase } = await getAppUserContext();
  if (!user || !profile || !ownerId) redirect("/login");

  // Fetch workday settings
  const { data: workdaySettings } = await supabase
    .from("workday_settings")
    .select("*")
    .eq("owner_id", ownerId)
    .single();

  // Fetch team members (for Users section)
  const { data: teamMembers } = await supabase
    .from("users")
    .select("id, auth_id, name_th, name_en, role")
    .or(`id.eq.${ownerId},owner_id.eq.${ownerId}`)
    .order("role");

  // Fetch workers eligible for role assignment (active, any status)
  const { data: workers } = await supabase
    .from("workers")
    .select("id, name_th, name_en, phone, auth_user_id")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  const normalizedProfile = { ...profile, email: user.email ?? null, is_active: true };
  const normalizedTeamMembers = (teamMembers ?? []).map((member) => ({
      ...member,
      email: member.auth_id === user.id ? user.email ?? null : null,
      is_active: true,
    }));

  return (
    <SettingsClient
      profile={normalizedProfile}
      workdaySettings={workdaySettings}
      teamMembers={normalizedTeamMembers}
      workers={workers ?? []}
      ownerId={ownerId}
    />
  );
}
