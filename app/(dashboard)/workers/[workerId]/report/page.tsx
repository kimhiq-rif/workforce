// Copyright © 2026 Workforce. All rights reserved.
// Printable worker report — opens in new tab via window.open from WorkerProfileClient.
import { getAppUserContext } from "@/lib/auth-context";
import { notFound, redirect } from "next/navigation";
import { formatThaiDate, formatTime, formatCurrency } from "@/lib/format";
import PrintButton from "@/components/ui/PrintButton";

export const dynamic = "force-dynamic";

interface Props { params: { workerId: string } }

export default async function WorkerReportPage({ params }: Props) {
  const { user, profile, ownerId, serviceClient: supabase } = await getAppUserContext();
  if (!user || !profile || !ownerId) redirect("/login");

  const { data: worker } = await supabase
    .from("workers")
    .select("*")
    .eq("id", params.workerId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!worker) notFound();

  const { data: ownerProfile } = await supabase
    .from("users")
    .select("name_th, name_en")
    .eq("id", ownerId)
    .maybeSingle();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  const { data: attendance } = await supabase
    .from("attendance_events")
    .select("event_date, arrival_time, status, is_late, wage_amount, site:site_id(name_th)")
    .eq("worker_id", params.workerId)
    .gte("event_date", fromDate)
    .order("event_date", { ascending: false });

  const { data: advances } = await supabase
    .from("advances")
    .select("amount, reason, status, created_at")
    .eq("worker_id", params.workerId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  const rows = (attendance ?? []).map((a) => ({
    ...a,
    site: Array.isArray(a.site) ? (a.site[0] ?? null) : a.site,
  }));

  const daysWorked = rows.filter((a) => (a.wage_amount ?? 0) > 0).length;
  const lateDays = rows.filter((a) => a.is_late).length;
  const halfDays = rows.filter((a) => a.status === "half_day_am" || a.status === "half_day_pm").length;
  const totalWage = rows.reduce((s, a) => s + (a.wage_amount ?? 0), 0);
  const pendingAdvances = (advances ?? []).filter((a) => a.status === "pending").reduce((s, a) => s + a.amount, 0);
  const netPay = totalWage - pendingAdvances;

  const today = new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "long", day: "numeric" });
  const periodFrom = thirtyDaysAgo.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });
  const periodTo = new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" });

  function statusLabel(status: string, isLate: boolean) {
    if (isLate) return "สาย";
    if (status === "on_site") return "ทำงาน";
    if (status === "half_day_am" || status === "half_day_pm") return "ครึ่งวัน";
    if (status === "missing") return "ขาด";
    if (status === "rain") return "ฝน";
    if (status === "day_off") return "หยุด";
    return status;
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');
        /* Design tokens: Violet #6C5CE7 | Field Blue #1E3A8A | Orange #FF6A00 | Lavender #F2F4FF */
        body { font-family: 'Sarabun', 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #111827; background: #F5F6FA; }
        .print-page { max-width: 820px; margin: 32px auto; padding: 40px 48px; background: white; box-shadow: 0 2px 16px rgba(108,92,231,0.10); border-radius: 10px; }
        .rpt-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #6C5CE7; padding-bottom: 16px; margin-bottom: 24px; }
        .rpt-logo { font-size: 24px; font-weight: 800; color: #6C5CE7; }
        .rpt-logo small { display: block; font-size: 12px; font-weight: 400; color: #6B7280; margin-top: 2px; }
        .rpt-meta { text-align: right; font-size: 12px; color: #6B7280; }
        .rpt-worker-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
        .rpt-info-block { background: #F2F4FF; border: 1px solid #D9CCFD; border-radius: 8px; padding: 14px; }
        .rpt-info-block h3 { font-size: 11px; color: #6C5CE7; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; font-weight: 700; }
        .rpt-info-row { display: flex; justify-content: space-between; font-size: 14px; padding: 5px 0; border-bottom: 1px solid #EDE9FE; }
        .rpt-info-row:last-child { border-bottom: none; }
        .rpt-stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .rpt-stat { background: #F2F4FF; border: 1px solid #D9CCFD; border-radius: 8px; padding: 12px; text-align: center; }
        .rpt-stat .num { font-size: 28px; font-weight: 800; color: #6C5CE7; }
        .rpt-stat .lbl { font-size: 11px; color: #6B7280; margin-top: 3px; line-height: 1.4; }
        .rpt-section-title { font-size: 16px; font-weight: 700; color: #1E3A8A; margin-bottom: 10px; margin-top: 22px; border-left: 3px solid #FF6A00; padding-left: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1E3A8A; color: white; padding: 9px 12px; font-size: 12px; text-align: left; letter-spacing: 0.3px; }
        td { padding: 8px 12px; font-size: 14px; border-bottom: 1px solid #F3F4F6; vertical-align: middle; }
        tr:nth-child(even) td { background: #F9FAFB; }
        .td-late { color: #EF4444; font-weight: 700; }
        .td-half { color: #F59E0B; font-weight: 600; }
        .rpt-totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 22px; }
        .rpt-total-box { border-radius: 10px; padding: 16px; }
        .rpt-total-box .lbl { font-size: 11px; color: #6B7280; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; }
        .rpt-total-box .amt { font-size: 26px; font-weight: 800; }
        .rpt-footer { margin-top: 32px; border-top: 1px solid #EDE9FE; padding-top: 12px; display: flex; justify-content: space-between; font-size: 12px; color: #9CA3AF; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-page { margin: 0; padding: 20px 28px; box-shadow: none; border-radius: 0; }
          table th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .rpt-stat { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .rpt-total-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .rpt-info-block { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="no-print"><PrintButton /></div>

      <div className="print-page">
        {/* Header */}
        <div className="rpt-header">
          <div>
            <div className="rpt-logo">
              Workforce
              <small>Driven by Proof · รายงานพนักงาน · Worker Report</small>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: "#6B7280" }}>{ownerProfile?.name_th ?? ""}</div>
          </div>
          <div className="rpt-meta">
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{today}</div>
            <div>ช่วงเวลา · Period: {periodFrom} – {periodTo}</div>
            <div>30 วันล่าสุด · Last 30 days</div>
          </div>
        </div>

        {/* Worker info + stats */}
        <div className="rpt-worker-grid">
          <div className="rpt-info-block">
            <h3>ข้อมูลพนักงาน · Worker info</h3>
            <div className="rpt-info-row"><span>ชื่อ</span><strong>{worker.name_th}</strong></div>
            <div className="rpt-info-row"><span>Name</span><span>{worker.name_en}</span></div>
            {worker.role_th && <div className="rpt-info-row"><span>ตำแหน่ง</span><span>{worker.role_th}</span></div>}
            {worker.phone && <div className="rpt-info-row"><span>โทร</span><span>{worker.phone}</span></div>}
            {(worker as any).email && <div className="rpt-info-row"><span>Email</span><span>{(worker as any).email}</span></div>}
            <div className="rpt-info-row"><span>ค่าแรง/วัน</span><strong>฿{formatCurrency(worker.daily_wage)}</strong></div>
            {worker.is_temporary && <div className="rpt-info-row"><span>ประเภท</span><span>ชั่วคราว · Temporary</span></div>}
          </div>

          <div className="rpt-stat-grid">
            <div className="rpt-stat">
              <div className="num">{daysWorked}</div>
              <div className="lbl">วันทำงาน<br />Days worked</div>
            </div>
            <div className="rpt-stat" style={{ background: lateDays > 0 ? "#FFF1F2" : "#F0FDF4", borderColor: lateDays > 0 ? "#FECDD3" : "#BBF7D0" }}>
              <div className="num" style={{ color: lateDays > 0 ? "#EF4444" : "#22C55E" }}>{lateDays}</div>
              <div className="lbl">มาสาย<br />Late</div>
            </div>
            <div className="rpt-stat" style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}>
              <div className="num" style={{ color: "#F59E0B" }}>{halfDays}</div>
              <div className="lbl">ครึ่งวัน<br />Half days</div>
            </div>
            <div className="rpt-stat" style={{ background: pendingAdvances > 0 ? "#FFF1F2" : "#F0FDF4", borderColor: pendingAdvances > 0 ? "#FECDD3" : "#BBF7D0" }}>
              <div className="num" style={{ fontSize: 20, color: pendingAdvances > 0 ? "#EF4444" : "#22C55E", lineHeight: 1.2 }}>฿{formatCurrency(pendingAdvances)}</div>
              <div className="lbl">เบิกล่วงหน้า<br />Advance</div>
            </div>
          </div>
        </div>

        {/* Attendance log */}
        <div className="rpt-section-title">ตารางเวลาทำงาน · Attendance log</div>
        <table>
          <thead>
            <tr>
              <th>วันที่ · Date</th>
              <th>ไซต์ · Site</th>
              <th>เวลาเข้า · Arrival</th>
              <th>สถานะ · Status</th>
              <th style={{ textAlign: "right" }}>ค่าแรง · Wage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.event_date}>
                <td>{formatThaiDate(a.event_date)}</td>
                <td>{(a.site as any)?.name_th ?? "–"}</td>
                <td>{a.arrival_time ? formatTime(a.arrival_time) : "–"}</td>
                <td className={a.is_late ? "td-late" : (a.status === "half_day_am" || a.status === "half_day_pm") ? "td-half" : ""}>
                  {statusLabel(a.status, a.is_late)}
                </td>
                <td style={{ textAlign: "right" }}>{(a.wage_amount ?? 0) > 0 ? `฿${formatCurrency(a.wage_amount!)}` : "–"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#9CA3AF", padding: "20px" }}>ยังไม่มีประวัติ · No history</td></tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="rpt-totals">
          <div className="rpt-total-box" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <div className="lbl">รายได้รวม · Total earned</div>
            <div className="amt" style={{ color: "#22C55E" }}>฿{formatCurrency(totalWage)}</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{daysWorked} วัน × ฿{formatCurrency(worker.daily_wage)}</div>
          </div>
          <div className="rpt-total-box" style={{ background: pendingAdvances > 0 ? "#FFF1F2" : "#F9FAFB", border: `1px solid ${pendingAdvances > 0 ? "#FECDD3" : "#E5E7EB"}` }}>
            <div className="lbl">เบิกล่วงหน้า · Advance</div>
            <div className="amt" style={{ color: pendingAdvances > 0 ? "#EF4444" : "#9CA3AF" }}>฿{formatCurrency(pendingAdvances)}</div>
          </div>
          <div className="rpt-total-box" style={{ background: "#F2F4FF", border: "1px solid #D9CCFD" }}>
            <div className="lbl">ยอดสุทธิ · Net payable</div>
            <div className="amt" style={{ color: "#6C5CE7" }}>฿{formatCurrency(Math.max(0, netPay))}</div>
          </div>
        </div>

        <div className="rpt-footer">
          <span>Workforce · Driven by Proof</span>
          <span>{worker.name_th} · {today}</span>
        </div>
      </div>
    </>
  );
}
