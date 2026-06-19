// Copyright © 2026 Workforce. All rights reserved.
import { getAppUserContext } from "@/lib/auth-context";
import { TeamClient } from "@/components/screens/Team/TeamClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { user, profile, ownerId, serviceClient: supabase } = await getAppUserContext();
  if (!user || !ownerId) redirect("/login");

  if (profile?.role !== "owner") {
    return (
      <div style={{ padding: "60px 32px", textAlign: "center", color: "var(--text-muted)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Owner only · เฉพาะเจ้าของ</div>
        <div style={{ fontSize: 14, marginTop: 6 }}>ניהול צוות זמין לבעלים בלבד</div>
      </div>
    );
  }

  const { data: members } = await supabase
    .from("users")
    .select("id, auth_id, role, name_th, name_en, phone, created_at")
    .eq("owner_id", ownerId)
    .order("created_at");

  return (
    <TeamClient
      members={members ?? []}
      ownerName={profile.name_th}
    />
  );
}
