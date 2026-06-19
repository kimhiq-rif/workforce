// Copyright © 2026 Workforce. All rights reserved.
import { getAppUserContext } from "@/lib/auth-context";
import { SuppliersClient } from "@/components/screens/Suppliers/SuppliersClient";
import { redirect } from "next/navigation";
import { todayBangkok } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const { user, profile, ownerId, serviceClient: supabase } = await getAppUserContext();
  if (!user || !profile || !ownerId) redirect("/login");
  const today = todayBangkok();

  // Suppliers list
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name_th, name_en, contact_phone, category, qr_code_data")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  // Recent receipts (last 30 days) with supplier info
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  let receiptsQuery = supabase
    .from("receipts")
    .select(`
      id, amount, status, category, description, photo_url,
      created_at,
      site:site_id(id, name_th, name_en),
      supplier:supplier_id(id, name_th, name_en)
    `)
    .eq("owner_id", ownerId)
    .gte("created_at", `${fromDate}T00:00:00+07:00`)
    .order("created_at", { ascending: false });

  // Driver Manager sees only their own submissions
  if (profile.role === "technical_admin") {
    receiptsQuery = receiptsQuery.eq("submitted_by", profile.id);
  }

  const { data: receipts } = await receiptsQuery;

  // Sites for receipt creation
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name_th, name_en")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("name_th");

  const normalizedReceipts = (receipts ?? []).map((receipt) => ({
    ...receipt,
    site: Array.isArray(receipt.site) ? receipt.site[0] ?? null : receipt.site,
    supplier: Array.isArray(receipt.supplier) ? receipt.supplier[0] ?? null : receipt.supplier,
  }));

  return (
    <SuppliersClient
      suppliers={suppliers ?? []}
      receipts={normalizedReceipts}
      sites={sites ?? []}
      ownerId={ownerId}
      today={today}
      userId={profile?.id}
    />
  );
}
