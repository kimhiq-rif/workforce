import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { DailyReportData, SiteReportData } from "@/lib/daily-report";
import {
  REPORT_COLORS,
  REPORT_FONT_FAMILY,
  ReportCircleBadge,
  ReportBrandHeader,
  ReportKeyValue,
  ReportKeyValueGrid,
  ReportKpiCard,
  ReportKpiGrid,
  ReportSection,
  ReportSeverityChip,
  ReportSignalRow,
  registerReportFonts,
  reportMoney,
  reportMoneyWithCurrency,
  reportText,
  truncateReportText,
  type HostedCompanyBrand,
  type ReportSeverity,
} from "@/lib/report-pdf-components";

const COLORS = REPORT_COLORS;
const FONT_FAMILY = REPORT_FONT_FAMILY;

function money(value: number): string {
  return reportMoney(value);
}

function moneyWithCurrency(value: number): string {
  return reportMoneyWithCurrency(value);
}

function text(value: string | number | null | undefined): string {
  return reportText(value);
}

function truncate(value: string | number | null | undefined, max = 88): string {
  return truncateReportText(value, max);
}

function siteName(site: SiteReportData): string {
  const en = text(site.siteNameEn);
  const th = text(site.siteNameTh);
  if (en && th && en !== th) return `${en} / ${th}`;
  return en || th || "Unnamed site / ไซต์ไม่มีชื่อ";
}

function statusColor(count: number, okColor = COLORS.success) {
  return count > 0 ? COLORS.danger : okColor;
}

const styles = StyleSheet.create({
  page: {
    padding: 26,
    paddingBottom: 58,
    fontFamily: FONT_FAMILY,
    fontSize: 9.5,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.white,
  },
  header: {
    margin: -26,
    marginBottom: 20,
    paddingTop: 26,
    paddingRight: 26,
    paddingBottom: 22,
    paddingLeft: 26,
    backgroundColor: COLORS.lavender,
    borderBottomWidth: 4,
    borderBottomColor: COLORS.brandAccent,
    borderLeftWidth: 7,
    borderLeftColor: COLORS.brandViolet,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 22,
  },
  logoLockup: {
    width: 225,
    flexDirection: "column",
    gap: 8,
  },
  logoMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoTextBlock: {
    flexDirection: "column",
  },
  logoWord: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.05,
  },
  logoTagline: {
    marginTop: 4,
    color: COLORS.brandAccent,
    fontSize: 10.5,
    fontWeight: 600,
  },
  clientLogoSlot: {
    width: 205,
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 7,
    backgroundColor: COLORS.white,
  },
  clientLogoEyebrow: {
    color: COLORS.textMuted,
    fontSize: 6.8,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  clientLogoName: {
    marginTop: 2,
    color: COLORS.textPrimary,
    fontSize: 9.2,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  clientLogoFrame: {
    marginTop: 4,
    height: 24,
    borderRadius: 5,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  clientLogoImage: {
    maxWidth: 150,
    maxHeight: 20,
    objectFit: "contain",
  },
  headerDivider: {
    width: 1,
    height: 92,
    backgroundColor: "#CBD5E1",
  },
  brandMark: {
    width: 64,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: 700,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.12,
  },
  subtitle: {
    marginTop: 5,
    color: COLORS.textSecondary,
    fontSize: 11.5,
    fontWeight: 600,
  },
  meta: {
    marginTop: 3,
    color: COLORS.textMuted,
    fontSize: 9.2,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
  },
  metaText: {
    color: COLORS.textPrimary,
    fontSize: 10.8,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  metaSub: {
    color: COLORS.textMuted,
    fontSize: 8.8,
    lineHeight: 1.25,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 18,
  },
  kpiCard: {
    width: "31.9%",
    minHeight: 72,
    paddingTop: 13,
    paddingRight: 11,
    paddingBottom: 10,
    paddingLeft: 46,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 7,
  },
  kpiIcon: {
    position: "absolute",
    left: 13,
    top: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    color: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    fontWeight: 700,
  },
  kpiAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
  },
  kpiLabel: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  kpiValue: {
    marginTop: 6,
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.05,
  },
  section: {
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 7,
    backgroundColor: COLORS.white,
  },
  sectionHeader: {
    marginBottom: 5,
    color: COLORS.textPrimary,
    fontSize: 15.2,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  sectionSub: {
    color: COLORS.textMuted,
    fontSize: 8.4,
    fontWeight: 500,
  },
  actionBox: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    paddingVertical: 5,
  },
  marker: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 5,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: COLORS.textPrimary,
    fontSize: 9.8,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  rowDetail: {
    marginTop: 2,
    color: COLORS.textMuted,
    fontSize: 8.4,
    lineHeight: 1.28,
  },
  keyValueGrid: {
    flexDirection: "row",
    flexWrap: "nowrap",
    marginTop: 6,
  },
  keyValue: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
  },
  receiptGrid: {
    flexDirection: "row",
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 7,
    overflow: "hidden",
  },
  receiptCell: {
    flex: 1,
    padding: 8,
    minHeight: 64,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  receiptIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    color: COLORS.white,
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 5,
  },
  keyLabel: {
    color: COLORS.textMuted,
    fontSize: 7.8,
    fontWeight: 600,
    lineHeight: 1.2,
  },
  keyValueText: {
    marginTop: 4,
    color: COLORS.textPrimary,
    fontSize: 10.4,
    fontWeight: 700,
  },
  siteCard: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  siteName: {
    color: COLORS.textPrimary,
    fontSize: 10.6,
    fontWeight: 700,
  },
  siteMeta: {
    marginTop: 3,
    color: COLORS.textMuted,
    fontSize: 8.5,
  },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 7,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.lavender,
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tableTotalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  tableCell: {
    paddingVertical: 7,
    paddingHorizontal: 7,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    fontSize: 8.6,
    lineHeight: 1.25,
  },
  tableHeaderText: {
    color: COLORS.textPrimary,
    fontSize: 8.2,
    fontWeight: 700,
    textAlign: "center",
    lineHeight: 1.2,
  },
  tablePrimary: {
    color: COLORS.textPrimary,
    fontWeight: 700,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 38,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionIconCell: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextCell: {
    flex: 1.1,
    paddingVertical: 7,
    paddingHorizontal: 7,
  },
  actionDetailCell: {
    flex: 1.7,
    paddingVertical: 7,
    paddingHorizontal: 7,
  },
  severityCell: {
    width: 72,
    paddingVertical: 7,
    paddingHorizontal: 5,
    alignItems: "center",
  },
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 5,
    fontSize: 8.4,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    left: 26,
    right: 26,
    bottom: 20,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    color: COLORS.textMuted,
    fontSize: 7.5,
  },
});

function getHostedCompany(report: DailyReportData): HostedCompanyBrand {
  return report.hostCompany ?? {};
}

function Header({ report }: { report: DailyReportData }) {
  return (
    <ReportBrandHeader
      titleEn="Daily Report"
      titleTh="รายงานประจำวัน"
      date={report.date}
      generatedAt={report.generatedAt}
      hostedCompany={getHostedCompany(report)}
    />
  );
}

function ActionNeeded({ report }: { report: DailyReportData }) {
  const actions: Array<{
    color: string;
    icon: string;
    labelEn: string;
    labelTh: string;
    detailEn: string;
    detailTh: string;
    severity: ReportSeverity;
  }> = [
    ...report.blockReasons.map((reason) => ({
      color: COLORS.danger,
      icon: "!",
      labelEn: "Blocking Issue",
      labelTh: "ปัญหาบล็อก",
      detailEn: reason.messageEn || "Blocking issue",
      detailTh: reason.messageTh || "ต้องแก้ไขก่อนสร้างรายงาน",
      severity: "High" as const,
    })),
    ...report.receiptClosing.issues.slice(0, 6).map((issue) => ({
      color: issue.issueType === "missing_amount" ? COLORS.brandAccent : COLORS.danger,
      icon: issue.issueType === "missing_amount" ? "฿" : "!",
      labelEn: issue.issueType === "missing_amount" ? "Missing Amount" : "Receipt Issues",
      labelTh: issue.issueType === "missing_amount" ? "ยอดเงินหาย" : "ปัญหาใบเสร็จ",
      detailEn: issue.messageEn,
      detailTh: issue.messageTh,
      severity: issue.issueType === "missing_amount" ? ("High" as const) : ("Medium" as const),
    })),
  ];

  if (report.notReportedWorkers.length > 0) {
    actions.push({
      color: COLORS.blueSignal,
      icon: "i",
      labelEn: "No Report",
      labelTh: "ยังไม่รายงาน",
      detailEn: `${report.notReportedWorkers.length} worker has not reported.`,
      detailTh: `มีพนักงานยังไม่รายงาน ${report.notReportedWorkers.length} คน`,
      severity: "Low" as const,
    });
  }

  if (actions.length === 0) {
    return (
      <ReportSection title="Action Needed / ด่วน" subtitle="Fast owner scan / ดูสิ่งที่ต้องแก้ก่อน">
        <ReportSignalRow color={COLORS.success} title="No blocking action needed / ไม่มีรายการที่ต้องแก้ทันที" />
      </ReportSection>
    );
  }

  return (
    <ReportSection title="Action Needed / ด่วน" subtitle="Fix these before closing the day / แก้ไขก่อนปิดวัน">
      <View style={styles.actionBox}>
        {actions.slice(0, 8).map((action, index) => (
          <View key={`${action.labelEn}-${index}`} style={styles.actionRow} wrap={false}>
            <View style={styles.actionIconCell}>
              <ReportCircleBadge color={action.color} label={action.icon} />
            </View>
            <View style={styles.actionTextCell}>
              <Text style={styles.rowTitle}>{action.labelEn}</Text>
              <Text style={styles.rowDetail}>{action.labelTh}</Text>
            </View>
            <View style={styles.actionDetailCell}>
              <Text style={styles.rowDetail}>{truncate(action.detailEn, 76)}</Text>
              <Text style={styles.rowDetail}>{truncate(action.detailTh, 76)}</Text>
            </View>
            <ReportSeverityChip level={action.severity} />
          </View>
        ))}
      </View>
    </ReportSection>
  );
}

function SiteSummary({ sites }: { sites: SiteReportData[] }) {
  const activeSites = sites.filter((site) => site.presentCount > 0 || site.receipts.length > 0);
  const totals = activeSites.reduce(
    (acc, site) => ({
      workers: acc.workers + site.presentCount,
      late: acc.late + site.lateCount,
      receipts: acc.receipts + site.receiptTotal,
      total: acc.total + site.totalSiteCost,
    }),
    { workers: 0, late: 0, receipts: 0, total: 0 }
  );
  return (
    <ReportSection title="Site Summary / สรุปไซต์" subtitle="Only sites with activity today / แสดงเฉพาะไซต์ที่มีข้อมูลวันนี้">
      {activeSites.length === 0 ? (
        <ReportSignalRow color={COLORS.inactive} title="No site activity recorded today / วันนี้ไม่มีข้อมูลไซต์" />
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 2 }]}>Site / ไซต์</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.9 }]}>Workers{"\n"}พนักงาน</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.8 }]}>Late{"\n"}มาสาย</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.25 }]}>Receipts (THB){"\n"}ใบเสร็จ</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.25, borderRightWidth: 0 }]}>Total (THB){"\n"}รวมทั้งหมด</Text>
          </View>
          {activeSites.map((site) => (
            <View key={site.siteId} style={styles.tableRow} wrap={false}>
              <Text style={[styles.tableCell, styles.tablePrimary, { flex: 2 }]}>{siteName(site)}</Text>
              <Text style={[styles.tableCell, { flex: 0.9, textAlign: "center" }]}>{site.presentCount}</Text>
              <Text style={[styles.tableCell, { flex: 0.8, textAlign: "center", color: site.lateCount > 0 ? COLORS.brandAccent : COLORS.textSecondary }]}>{site.lateCount}</Text>
              <Text style={[styles.tableCell, { flex: 1.25, textAlign: "center" }]}>{money(site.receiptTotal)}</Text>
              <Text style={[styles.tableCell, styles.tablePrimary, { flex: 1.25, textAlign: "center", borderRightWidth: 0 }]}>{money(site.totalSiteCost)}</Text>
            </View>
          ))}
          <View style={styles.tableTotalRow} wrap={false}>
            <Text style={[styles.tableCell, styles.tablePrimary, { flex: 2 }]}>Total / รวมทั้งหมด</Text>
            <Text style={[styles.tableCell, styles.tablePrimary, { flex: 0.9, textAlign: "center" }]}>{totals.workers}</Text>
            <Text style={[styles.tableCell, styles.tablePrimary, { flex: 0.8, textAlign: "center", color: totals.late > 0 ? COLORS.brandAccent : COLORS.textPrimary }]}>{totals.late}</Text>
            <Text style={[styles.tableCell, styles.tablePrimary, { flex: 1.25, textAlign: "center" }]}>{money(totals.receipts)}</Text>
            <Text style={[styles.tableCell, styles.tablePrimary, { flex: 1.25, textAlign: "center", borderRightWidth: 0 }]}>{money(totals.total)}</Text>
          </View>
        </View>
      )}
    </ReportSection>
  );
}

function WorkersAttention({ report }: { report: DailyReportData }) {
  const lateWorkers = report.sites.flatMap((site) =>
    site.workers
      .filter((worker) => worker.isLate)
      .map((worker) => ({
        color: COLORS.brandAccent,
        title: `${text(worker.nameEn || worker.nameTh)} / ${text(worker.nameTh || worker.nameEn)}`,
        detail: `Late at ${siteName(site)} (${worker.arrivalTime ?? "no time"}) / มาสาย`,
      }))
  );

  const notReported = report.notReportedWorkers.slice(0, 8).map((worker) => ({
    color: COLORS.danger,
    title: `${text(worker.nameEn || worker.nameTh)} / ${text(worker.nameTh || worker.nameEn)}`,
    detail: `Assigned ${text(worker.assignedSiteNameTh ?? "No site")} · Photo ${worker.photoUrl ? "yes" : "no"} / ยังไม่รายงาน`,
  }));

  const absences = report.markedAbsences.slice(0, 8).map((absence) => ({
    color: COLORS.blueSignal,
    title: `${text(absence.nameEn || absence.nameTh)} / ${text(absence.nameTh || absence.nameEn)}`,
    detail: `${text(absence.reason ?? absence.status)} · ${text(absence.siteNameTh ?? "No site")}${absence.note ? ` · ${text(absence.note)}` : ""}`,
  }));

  const rows = [...notReported, ...lateWorkers, ...absences].slice(0, 14);
  return (
    <ReportSection title="Workers Attention / พนักงานที่ต้องดูแล" subtitle="No report, late, and marked absence / ยังไม่รายงาน มาสาย และเหตุผลขาดงาน">
      {rows.length === 0 ? (
        <ReportSignalRow color={COLORS.success} title="No worker attention items / ไม่มีรายการพนักงานที่ต้องติดตาม" />
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.25 }]}>Worker{"\n"}พนักงาน</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.15 }]}>Site{"\n"}ไซต์</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.2 }]}>Issue{"\n"}ปัญหา</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.8 }]}>Time{"\n"}เวลา</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.9, borderRightWidth: 0 }]}>Status{"\n"}สถานะ</Text>
          </View>
          {rows.map((row, index) => {
            const [titleEn, titleTh] = row.title.split(" / ");
            const detail = row.detail ?? "";
            const timeMatch = detail.match(/\(([^)]+)\)/);
            const issue = row.color === COLORS.brandAccent ? "Late / มาสาย" : row.color === COLORS.danger ? "No Report / ยังไม่รายงาน" : "Absence / ขาดงาน";
            const status = row.color === COLORS.brandAccent ? "Monitor / ติดตาม" : row.color === COLORS.danger ? "Urgent / ด่วน" : "Review / ตรวจ";
            return (
              <View key={`${row.title}-${index}`} style={styles.tableRow} wrap={false}>
                <Text style={[styles.tableCell, styles.tablePrimary, { flex: 1.25 }]}>{titleEn}{"\n"}{titleTh}</Text>
                <Text style={[styles.tableCell, { flex: 1.15 }]}>{truncate(detail.replace(/\([^)]*\)/g, ""), 34)}</Text>
                <Text style={[styles.tableCell, { flex: 1.2, color: row.color }]}>{issue}</Text>
                <Text style={[styles.tableCell, { flex: 0.8, textAlign: "center" }]}>{timeMatch?.[1] ?? "-"}</Text>
                <Text style={[styles.tableCell, { flex: 0.9, textAlign: "center", borderRightWidth: 0, color: row.color }]}>{status}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ReportSection>
  );
}

function ReceiptClosing({ report }: { report: DailyReportData }) {
  const { receiptClosing } = report;
  return (
    <ReportSection title="Receipt Closing / ปิดใบเสร็จ" subtitle="Confirmed, pending, and driver cash / ยืนยัน รอดำเนินการ และเงินสดคนขับ" wrap={false}>
      <View style={styles.receiptGrid}>
        <View style={styles.receiptCell}>
          <ReportCircleBadge color={COLORS.success} label="OK" />
          <Text style={styles.keyLabel}>Approved Receipts{"\n"}อนุมัติแล้ว</Text>
          <Text style={[styles.keyValueText, { color: COLORS.success }]}>{receiptClosing.approvedCount}</Text>
          <Text style={styles.rowTitle}>{moneyWithCurrency(receiptClosing.approvedTotal)}</Text>
        </View>
        <View style={styles.receiptCell}>
          <ReportCircleBadge color={COLORS.blueSignal} label="P" />
          <Text style={styles.keyLabel}>Pending with Amount{"\n"}รอยอดเงิน</Text>
          <Text style={[styles.keyValueText, { color: COLORS.blueSignal }]}>{receiptClosing.pendingWithAmountCount}</Text>
          <Text style={styles.rowTitle}>{moneyWithCurrency(receiptClosing.pendingWithAmountTotal)}</Text>
        </View>
        <View style={styles.receiptCell}>
          <ReportCircleBadge color={COLORS.warning} label="-" />
          <Text style={styles.keyLabel}>Pending without Amount{"\n"}รอยอดเงิน</Text>
          <Text style={[styles.keyValueText, { color: COLORS.warning }]}>{receiptClosing.pendingWithoutAmountCount}</Text>
          <Text style={styles.rowTitle}>-</Text>
        </View>
        <View style={styles.receiptCell}>
          <ReportCircleBadge color={COLORS.danger} label="!" />
          <Text style={styles.keyLabel}>Problem Receipts{"\n"}ใบเสร็จมีปัญหา</Text>
          <Text style={[styles.keyValueText, { color: COLORS.danger }]}>{receiptClosing.problematicCount}</Text>
          <Text style={styles.rowTitle}>-</Text>
        </View>
        <View style={[styles.receiptCell, { borderRightWidth: 0 }]}>
          <ReportCircleBadge color={COLORS.brandViolet} label="฿" />
          <Text style={styles.keyLabel}>Driver Cash Used{"\n"}เงินสดคนขับ</Text>
          <Text style={[styles.keyValueText, { color: COLORS.brandViolet }]}>{moneyWithCurrency(receiptClosing.driverCashUsed)}</Text>
          <Text style={styles.rowTitle}>{receiptClosing.driverCashReceiptCount} receipts</Text>
        </View>
      </View>
    </ReportSection>
  );
}

function Corrections({ report }: { report: DailyReportData }) {
  const { totals } = report;
  if (totals.originalTotalExpenses === null || totals.correctedTotalExpenses === null) return null;

  return (
    <ReportSection title="Corrected Totals / ยอดรวมที่แก้ไข" subtitle="Original versus corrected financial total / เปรียบเทียบยอดก่อนและหลังแก้">
      <ReportKeyValueGrid>
        <ReportKeyValue labelEn="Original" labelTh="ยอดเดิม" value={moneyWithCurrency(totals.originalTotalExpenses)} />
        <ReportKeyValue labelEn="Corrected" labelTh="ยอดที่แก้ไข" value={moneyWithCurrency(totals.correctedTotalExpenses)} />
        <ReportKeyValue labelEn="Delta" labelTh="ส่วนต่าง" value={moneyWithCurrency(totals.correctionDelta)} color={totals.correctionDelta >= 0 ? COLORS.brandAccent : COLORS.success} />
        <ReportKeyValue labelEn="Corrections" labelTh="จำนวนการแก้ไข" value={String(report.correctionSummary.financialCorrections)} />
      </ReportKeyValueGrid>
    </ReportSection>
  );
}

function DailyReportDocument({ report }: { report: DailyReportData }) {
  const { totals } = report;
  return (
    <Document title={`Daily Report ${report.date}`} author="Workforce">
      <Page size="A4" style={styles.page} wrap>
        <Header report={report} />

        <ReportKpiGrid>
          <ReportKpiCard labelEn="Confirmed Total" labelTh="ยอดรวมยืนยัน" value={money(totals.totalExpenses)} accent={COLORS.brandAccent} icon="OK" />
          <ReportKpiCard labelEn="Potential Total" labelTh="ยอดรวมคาดการณ์" value={money(totals.potentialTotalExpenses)} accent={COLORS.brandViolet} icon="P" />
          <ReportKpiCard labelEn="Workers Reported" labelTh="รายงานแล้ว" value={String(totals.totalPresent)} accent={COLORS.brandPrimary} icon="W" />
          <ReportKpiCard labelEn="Late" labelTh="มาสาย" value={String(totals.totalLate)} accent={totals.totalLate > 0 ? COLORS.warning : COLORS.success} icon="L" />
          <ReportKpiCard labelEn="No Report" labelTh="ยังไม่รายงาน" value={String(report.notReportedWorkers.length)} accent={report.notReportedWorkers.length > 0 ? COLORS.inactive : COLORS.success} icon="NR" />
          <ReportKpiCard labelEn="Receipt Issues" labelTh="ปัญหาใบเสร็จ" value={String(report.receiptClosing.issues.length)} accent={statusColor(report.receiptClosing.issues.length)} icon="!" />
        </ReportKpiGrid>

        <ActionNeeded report={report} />

        <ReportSection title="Owner Summary / สรุปสำหรับเจ้าของ" subtitle="High-level cost and attendance / ภาพรวมต้นทุนและการเข้างาน">
          <ReportKeyValueGrid>
            <ReportKeyValue labelEn="Labor" labelTh="ค่าแรง" value={moneyWithCurrency(totals.totalLaborCost)} />
            <ReportKeyValue labelEn="Confirmed receipts" labelTh="ใบเสร็จยืนยัน" value={moneyWithCurrency(totals.totalReceiptAmount)} />
            <ReportKeyValue labelEn="Transfers" labelTh="ย้ายไซต์" value={String(totals.totalTransfers)} />
            <ReportKeyValue labelEn="Marked absences" labelTh="ขาดงานมีเหตุผล" value={String(report.markedAbsences.length)} />
          </ReportKeyValueGrid>
        </ReportSection>

        <ReceiptClosing report={report} />
        <Corrections report={report} />
        <SiteSummary sites={report.sites} />
        <WorkersAttention report={report} />

        <ReportSection title="Cost Categories / หมวดต้นทุน" subtitle="Largest operational cost groups / กลุ่มต้นทุนหลัก">
          {report.expenseCategories.slice(0, 8).map((category, index) => (
            <ReportSignalRow
              key={`${category.category}-${index}`}
              color={index === 0 ? COLORS.brandAccent : COLORS.blueSignal}
              title={`${index + 1}. ${text(category.category)} / ${text(category.nameTh || category.category)} · ${moneyWithCurrency(category.amount)}`}
              detail={`Count ${category.count} · Severity ${category.severityScore.toFixed(1)}`}
            />
          ))}
        </ReportSection>

        <View style={styles.footer} fixed>
          <Text>Workforce · Driven by Proof</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function generateDailyReportPdf(report: DailyReportData): Promise<Buffer> {
  registerReportFonts();
  const output = await renderToBuffer(<DailyReportDocument report={report} />);
  return Buffer.isBuffer(output) ? output : Buffer.from(output as Uint8Array);
}

