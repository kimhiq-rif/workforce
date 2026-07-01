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
      id, site_id, supplier_id, receipt_number, amount, status, category, description, notes, photo_url,
      payment_type, paid_from_driver_cash, gps_lat, gps_lng, submitted_by, created_at,
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

  const normalizedReceipts = await Promise.all(
    (receipts ?? []).map(async (receipt) => {
      let photoUrl = receipt.photo_url as string | null;
      if (photoUrl && !photoUrl.startsWith("http")) {
        const { data: signed } = await supabase.storage
          .from("receipt-photos")
          .createSignedUrl(photoUrl, 3600);
        photoUrl = signed?.signedUrl ?? null;
      }
      return {
        ...receipt,
        photo_url: photoUrl,
        site: Array.isArray(receipt.site) ? receipt.site[0] ?? null : receipt.site,
        supplier: Array.isArray(receipt.supplier) ? receipt.supplier[0] ?? null : receipt.supplier,
      };
    })
  );

  // Driver cash float data
  const { data: driverManagers } = await supabase
    .from("users")
    .select("id, name_th, name_en")
    .eq("owner_id", ownerId)
    .eq("role", "technical_admin");

  const { data: cashEntries } = await supabase
    .from("driver_cash_entries")
    .select("driver_user_id, amount")
    .eq("owner_id", ownerId);

  const { data: allReceiptTotals } = await supabase
    .from("receipts")
    .select("submitted_by, amount")
    .eq("owner_id", ownerId)
    .not("submitted_by", "is", null);

  const driverCashData = (driverManagers ?? []).map((dm) => {
    const totalGiven = (cashEntries ?? [])
      .filter((e) => e.driver_user_id === dm.id)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const totalSpent = (allReceiptTotals ?? [])
      .filter((r) => r.submitted_by === dm.id)
      .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
    return { driver: dm, totalGiven, totalSpent, balance: totalGiven - totalSpent };
  });

  let myBalance: { totalGiven: number; totalSpent: number; balance: number } | null = null;
  if (profile.role === "technical_admin") {
    const myGiven = (cashEntries ?? [])
      .filter((e) => e.driver_user_id === profile.id)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const mySpent = normalizedReceipts
      .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
    myBalance = { totalGiven: myGiven, totalSpent: mySpent, balance: myGiven - mySpent };
  }

  // Pending QR payments (owner sees these to approve)
  const { data: pendingQrRaw } = await supabase
    .from("receipts")
    .select("id, amount, description, notes, qr_value, submitted_by, created_at, site:site_id(id, name_th, name_en), scanned_by_user:submitted_by(name_th, name_en)")
    .eq("owner_id", ownerId)
    .eq("status", "pending_qr")
    .order("created_at", { ascending: false });

  const pendingQrReceipts = (pendingQrRaw ?? []).map((r) => ({
    ...r,
    site: Array.isArray(r.site) ? r.site[0] ?? null : r.site,
    scanned_by_user: Array.isArray(r.scanned_by_user) ? r.scanned_by_user[0] ?? null : r.scanned_by_user,
  }));

  return (
    <SuppliersClient
      suppliers={suppliers ?? []}
      receipts={normalizedReceipts}
      sites={sites ?? []}
      ownerId={ownerId}
      today={today}
      userId={profile?.id}
      driverCashData={driverCashData}
      myBalance={myBalance}
      pendingQrReceipts={pendingQrReceipts}
    />
  );
}
