import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { HalfMonthReportData, WorkerPayrollRow } from "@/lib/halfmonth-report";
import {
  REPORT_COLORS,
  REPORT_FONT_FAMILY,
  ReportBrandHeader,
  ReportKeyValue,
  ReportKeyValueGrid,
  ReportKpiCard,
  ReportKpiGrid,
  ReportSection,
  ReportSignalRow,
  registerReportFonts,
  reportMoney,
  reportMoneyWithCurrency,
  reportText,
  truncateReportText,
} from "@/lib/report-pdf-components";

const COLORS = REPORT_COLORS;
const FONT_FAMILY = REPORT_FONT_FAMILY;

const styles = StyleSheet.create({
  page: {
    padding: 26,
    paddingBottom: 58,
    fontFamily: FONT_FAMILY,
    fontSize: 9.5,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.white,
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
    minHeight: 40,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: "center",
  },
  tableTotalRow: {
    flexDirection: "row",
    minHeight: 40,
    borderTopWidth: 1,
    borderTopColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    alignItems: "center",
  },
  tableCell: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    fontSize: 8.3,
    lineHeight: 1.25,
  },
  tableHeaderText: {
    color: COLORS.textPrimary,
    fontSize: 7.8,
    fontWeight: 700,
    textAlign: "center",
    lineHeight: 1.2,
  },
  workerCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  workerPhoto: {
    width: 24,
    height: 24,
    borderRadius: 12,
    objectFit: "cover",
  },
  workerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.lavender,
    alignItems: "center",
    justifyContent: "center",
  },
  workerInitial: {
    color: COLORS.textPrimary,
    fontSize: 9,
    fontWeight: 700,
  },
  primaryText: {
    color: COLORS.textPrimary,
    fontWeight: 700,
  },
  mutedText: {
    color: COLORS.textMuted,
    fontSize: 7.5,
    lineHeight: 1.2,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  smallChip: {
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 4,
    borderWidth: 1,
    fontSize: 7,
    fontWeight: 700,
  },
  temporaryLabel: {
    marginTop: 4,
    color: COLORS.brandAccent,
    fontSize: 7.2,
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

function workerDisplayName(worker: WorkerPayrollRow) {
  const th = reportText(worker.nameTh);
  const en = reportText(worker.nameEn);
  return en && en !== th ? `${th}\n${en}` : th || en || "Unnamed worker";
}

function WorkerIdentity({ worker }: { worker: WorkerPayrollRow }) {
  const firstLetter = reportText(worker.nameTh || worker.nameEn).slice(0, 1) || "W";

  return (
    <View style={styles.workerCell}>
      {worker.photoUrl ? (
        <Image src={worker.photoUrl} style={styles.workerPhoto} />
      ) : (
        <View style={styles.workerAvatar}>
          <Text style={styles.workerInitial}>{firstLetter}</Text>
        </View>
      )}
      <View>
        <Text style={styles.primaryText}>{workerDisplayName(worker)}</Text>
        <Text style={styles.mutedText}>{truncateReportText(worker.siteNameTh || "-", 28)}</Text>
        {worker.isTemporary ? <Text style={styles.temporaryLabel}>Temporary / พนักงานชั่วคราว</Text> : null}
      </View>
    </View>
  );
}

function exceptionChips(worker: WorkerPayrollRow) {
  const chips: Array<{ label: string; color: string }> = [];
  if (worker.halfDays > 0) chips.push({ label: `Half ${worker.halfDays}`, color: COLORS.warning });
  if (worker.lateDays > 0) chips.push({ label: `Late ${worker.lateDays}`, color: COLORS.brandAccent });
  if (worker.sickDays > 0) chips.push({ label: `Sick ${worker.sickDays}`, color: COLORS.blueSignal });
  if (worker.dayOffDays > 0) chips.push({ label: `Day off ${worker.dayOffDays}`, color: COLORS.blueSignal });
  if (worker.familyEventDays > 0) chips.push({ label: `Family ${worker.familyEventDays}`, color: COLORS.brandViolet });
  if (worker.otherAbsenceDays > 0) chips.push({ label: `Other ${worker.otherAbsenceDays}`, color: COLORS.inactive });
  if (worker.missingDays > 0) chips.push({ label: `Missing ${worker.missingDays}`, color: COLORS.danger });
  return chips;
}

function WorkerTable({ workers, totals }: { workers: WorkerPayrollRow[]; totals?: HalfMonthReportData["totals"] }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.65 }]}>Worker{"\n"}พนักงาน</Text>
        <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.52 }]}>Days{"\n"}วัน</Text>
        <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.72 }]}>Work pay{"\n"}ค่าแรง</Text>
        <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.62 }]}>OT{"\n"}ล่วงเวลา</Text>
        <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.72 }]}>Advances{"\n"}มัดจำ</Text>
        <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 0.78, borderRightWidth: 0 }]}>Total to pay{"\n"}ยอดจ่าย</Text>
      </View>

      {workers.map((worker) => {
        const chips = exceptionChips(worker);

        return (
          <View key={worker.workerId} style={styles.tableRow} wrap={false}>
            <View style={[styles.tableCell, { flex: 1.65 }]}>
              <WorkerIdentity worker={worker} />
              {chips.length > 0 ? (
                <View style={styles.chips}>
                  {chips.slice(0, 5).map((chip) => (
                    <Text key={chip.label} style={[styles.smallChip, { color: chip.color, borderColor: chip.color }]}>
                      {chip.label}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
            <Text style={[styles.tableCell, { flex: 0.52, textAlign: "center" }]}>
              {worker.totalDays}
              {"\n"}
              <Text style={styles.mutedText}>F {worker.fullDays} / H {worker.halfDays}</Text>
            </Text>
            <Text style={[styles.tableCell, { flex: 0.72, textAlign: "right" }]}>{reportMoney(worker.grossWage)}</Text>
            <Text style={[styles.tableCell, { flex: 0.62, textAlign: "right", color: worker.overtimePay > 0 ? COLORS.brandAccent : COLORS.textMuted }]}>
              {worker.overtimePay > 0 ? reportMoney(worker.overtimePay) : "-"}
            </Text>
            <Text style={[styles.tableCell, { flex: 0.72, textAlign: "right", color: worker.advances > 0 ? COLORS.danger : COLORS.textMuted }]}>
              {worker.advances > 0 ? `-${reportMoney(worker.advances)}` : "-"}
            </Text>
            <Text style={[styles.tableCell, styles.primaryText, { flex: 0.78, textAlign: "right", borderRightWidth: 0, color: COLORS.success }]}>
              {reportMoney(worker.netPay)}
            </Text>
          </View>
        );
      })}

      {totals ? (
        <View style={styles.tableTotalRow} wrap={false}>
          <Text style={[styles.tableCell, styles.primaryText, { flex: 1.65 }]}>Total / รวมทั้งหมด</Text>
          <Text style={[styles.tableCell, styles.primaryText, { flex: 0.52, textAlign: "center" }]}>{totals.totalFullDays + totals.totalHalfDays}</Text>
          <Text style={[styles.tableCell, styles.primaryText, { flex: 0.72, textAlign: "right" }]}>{reportMoney(totals.totalGrossWage)}</Text>
          <Text style={[styles.tableCell, styles.primaryText, { flex: 0.62, textAlign: "right", color: COLORS.brandAccent }]}>{reportMoney(totals.totalOvertimePay)}</Text>
          <Text style={[styles.tableCell, styles.primaryText, { flex: 0.72, textAlign: "right", color: COLORS.danger }]}>-{reportMoney(totals.totalAdvances)}</Text>
          <Text style={[styles.tableCell, styles.primaryText, { flex: 0.78, textAlign: "right", borderRightWidth: 0, color: COLORS.success }]}>{reportMoney(totals.totalNetPay)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function HalfMonthReportDocument({ report }: { report: HalfMonthReportData }) {
  const regularWorkers = report.workers.filter((worker) => !worker.isTemporary);
  const temporaryWorkers = report.workers.filter((worker) => worker.isTemporary);
  const topWorkers = report.workers.slice(0, 3);

  return (
    <Document title={`Half-month Payroll ${report.periodStart} to ${report.periodEnd}`} author="Workforce">
      <Page size="A4" style={styles.page} wrap>
        <ReportBrandHeader
          titleEn="Half-month Payroll"
          titleTh="รายงานเงินเดือนครึ่งเดือน"
          date={report.periodEnd}
          generatedAt={report.generatedAt}
          hostedCompany={report.hostCompany}
        />

        <ReportKpiGrid>
          <ReportKpiCard labelEn="Total to pay" labelTh="ยอดจ่ายสุทธิ" value={reportMoney(report.totals.totalNetPay)} accent={COLORS.success} icon="THB" />
          <ReportKpiCard labelEn="Workers" labelTh="พนักงาน" value={String(report.totals.totalWorkers)} accent={COLORS.brandPrimary} icon="W" />
          <ReportKpiCard labelEn="Gross pay" labelTh="ค่าแรงรวม" value={reportMoney(report.totals.totalGross)} accent={COLORS.brandViolet} icon="G" />
          <ReportKpiCard labelEn="Advances" labelTh="มัดจำ" value={reportMoney(report.totals.totalAdvances)} accent={report.totals.totalAdvances > 0 ? COLORS.danger : COLORS.inactive} icon="-" />
          <ReportKpiCard labelEn="Half days" labelTh="ครึ่งวัน" value={String(report.totals.totalHalfDays)} accent={report.totals.totalHalfDays > 0 ? COLORS.warning : COLORS.success} icon="H" />
          <ReportKpiCard labelEn="Temporary" labelTh="พนักงานชั่วคราว" value={String(report.totals.temporaryWorkers)} accent={report.totals.temporaryWorkers > 0 ? COLORS.brandAccent : COLORS.inactive} icon="T" />
        </ReportKpiGrid>

        <ReportSection title="Period Summary / สรุปช่วงเวลา" subtitle={`Period ${report.periodStart} to ${report.periodEnd} / ${report.periodLabel}`}>
          <ReportKeyValueGrid>
            <ReportKeyValue labelEn="Work pay" labelTh="ค่าแรง" value={reportMoneyWithCurrency(report.totals.totalGrossWage)} />
            <ReportKeyValue labelEn="Overtime" labelTh="ล่วงเวลา" value={reportMoneyWithCurrency(report.totals.totalOvertimePay)} color={COLORS.brandAccent} />
            <ReportKeyValue labelEn="Advances" labelTh="มัดจำ" value={`-${reportMoneyWithCurrency(report.totals.totalAdvances)}`} color={COLORS.danger} />
            <ReportKeyValue labelEn="Total to pay" labelTh="ยอดจ่ายสุทธิ" value={reportMoneyWithCurrency(report.totals.totalNetPay)} color={COLORS.success} />
          </ReportKeyValueGrid>
        </ReportSection>

        {topWorkers.length > 0 ? (
          <ReportSection title="Largest Pay Rows / รายการจ่ายสูงสุด" subtitle="Top payroll rows for quick owner scan / รายการสำคัญสำหรับเจ้าของ">
            {topWorkers.map((worker, index) => (
              <ReportSignalRow
                key={worker.workerId}
                color={index === 0 ? COLORS.brandAccent : COLORS.blueSignal}
                title={`${index + 1}. ${reportText(worker.nameTh || worker.nameEn)} - ${reportMoneyWithCurrency(worker.netPay)}`}
                detail={`Work ${reportMoneyWithCurrency(worker.grossWage)} | OT ${reportMoneyWithCurrency(worker.overtimePay)} | Advances ${reportMoneyWithCurrency(worker.advances)}`}
              />
            ))}
          </ReportSection>
        ) : null}

        <ReportSection title="Workers Payroll / เงินเดือนพนักงาน" subtitle="Payroll only. Suppliers, receipts, driver cash, and project costs are excluded by spec.">
          {regularWorkers.length > 0 ? (
            <WorkerTable workers={regularWorkers} totals={report.totals} />
          ) : (
            <ReportSignalRow color={COLORS.inactive} title="No regular worker payroll rows / ไม่มีรายการพนักงานประจำ" />
          )}
        </ReportSection>

        {temporaryWorkers.length > 0 ? (
          <ReportSection title="Temporary Workers / พนักงานชั่วคราว" subtitle="Shown separately according to payroll spec / แยกจากพนักงานประจำ">
            <WorkerTable workers={temporaryWorkers} />
          </ReportSection>
        ) : null}

        <ReportSection title="Payroll Exceptions / ข้อยกเว้นเงินเดือน" subtitle="Only payroll-related exceptions appear here.">
          <ReportSignalRow color={COLORS.warning} title={`Half days / ครึ่งวัน: ${report.totals.totalHalfDays}`} />
          <ReportSignalRow color={COLORS.danger} title={`Unresolved missing days / ยังไม่รายงาน: ${report.totals.unresolvedMissingDays}`} />
        </ReportSection>

        <View style={styles.footer} fixed>
          <Text>Workforce | Driven by Proof</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function generateHalfMonthReportPdf(report: HalfMonthReportData): Promise<Buffer> {
  registerReportFonts();
  const output = await renderToBuffer(<HalfMonthReportDocument report={report} />);
  return Buffer.isBuffer(output) ? output : Buffer.from(output as Uint8Array);
}
