// Copyright © 2026 Workforce. All rights reserved.
import { getAppUserContext } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NoAssignmentPage() {
  const { user, profile } = await getAppUserContext();
  if (!user || !profile) redirect("/login");
  if (profile.role === "owner") redirect("/");
  if (profile.role === "technical_admin") redirect("/driver");

  const supabase = createClient();
  async function signOut() {
    "use server";
    const sb = createClient();
    await sb.auth.signOut();
    redirect("/login");
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#F9FAFB", gap: 16, textAlign: "center" }}>
      <div style={{ fontSize: 48 }}>🏗️</div>
      <div>
        <div className="th-text" style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>ยังไม่ได้รับมอบหมายไซต์</div>
        <div className="en-text" style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>No site assigned yet</div>
      </div>
      <div style={{ maxWidth: 280 }}>
        <div className="th-text" style={{ fontSize: 14, color: "#6B7280" }}>กรุณาติดต่อเจ้าของโครงการเพื่อรับการมอบหมายไซต์</div>
        <div className="en-text" style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>Please contact the owner to be assigned to a site</div>
      </div>
      <form action={signOut} style={{ marginTop: 8 }}>
        <button type="submit" style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", color: "#374151", fontSize: 14, cursor: "pointer" }}>
          <span className="th-text">ออกจากระบบ</span>
          <span className="en-text"> · Sign out</span>
        </button>
      </form>
    </div>
  );
}
