// Copyright © 2026 Workforce. All rights reserved.
import { redirect } from "next/navigation";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { OneSignalInit } from "@/components/OneSignalInit";
import { EnablePushPrompt } from "@/components/EnablePushPrompt";
import { ForcePasswordSetup } from "@/components/ForcePasswordSetup";
import { getAppUserContext } from "@/lib/auth-context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, ownerId } = await getAppUserContext();
  if (!user || !profile) redirect("/login");
  const needsPassword = profile.role !== "owner" && !profile.has_set_password;
  return (
    <>
      <NavigationProgress />
      <OneSignalInit userId={profile.id} ownerId={ownerId} />
      <EnablePushPrompt userId={profile.id} ownerId={ownerId} />
      {needsPassword && <ForcePasswordSetup />}
      {children}
    </>
  );
}
