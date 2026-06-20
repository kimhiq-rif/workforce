// Copyright © 2026 Workforce. All rights reserved.
import { getAppUserContext } from "@/lib/auth-context";
import { UserRoleProvider } from "@/components/layout/UserRoleContext";
import { ReceiptNotificationReceiver } from "@/components/layout/ReceiptNotificationReceiver";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, ownerId, serviceClient: supabase } = await getAppUserContext();
  if (!user || !profile) redirect("/login");
  if (profile.must_change_password) redirect("/change-password");

  let assignedSiteId: string | null = null;

  // For field managers and driver managers, find their linked worker record to get assigned site
  if (profile.role !== "owner" && ownerId) {
    const { data: linkedWorker } = await supabase
      .from("workers")
      .select("assigned_site_id")
      .eq("auth_user_id", user.id)
      .eq("owner_id", ownerId)
      .maybeSingle();

    assignedSiteId = linkedWorker?.assigned_site_id ?? null;
  }

  return (
    <UserRoleProvider role={profile.role} assignedSiteId={assignedSiteId}>
      <ReceiptNotificationReceiver />
      {children}
    </UserRoleProvider>
  );
}
