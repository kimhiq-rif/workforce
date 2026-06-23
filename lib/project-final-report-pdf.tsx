// Copyright © 2026 Workforce. All rights reserved.
// Project Final Report PDF — short version (real cost, no profit/clients).
import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ProjectFinalReportData } from "@/lib/project-final-report";
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

const styles = StyleSheet.create({
  page: {
    padding: 26,
    paddingBottom: 58,
    fontFamily: REPORT_FONT_FAMILY,
    fontSize: 9.5,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.white,
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  stageDot: { width: 9, height: 9, borderRadius: 5 },
  stageName: { flex: 1, fontSize: 9.8, fontWeight: 700, color: COLORS.textPrimary },
  stageMeta: { fontSize: 8.4, color: COLORS.textMuted, width: 150 },
  stageCost: { fontSize: 9.8, fontWeight: 700, color: COLORS.textPrimary, width: 90, textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 26,
    right: 26,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.6,
    color: COLORS.textMuted,
  },
});

function closeReasonLabel(reason: string | null, isClosed: boolean): string {
  if (!isClosed) return "Active / กำลังดำเนินการ";
  if (reason === "completed") return "Completed / เสร็จสมบูรณ์";
  if (reason === "stopped_cancelled") return "Stopped / หยุด/ยกเลิก";
  return "Closed / ปิดโครงการ";
}

function ProjectFinalDocument({ report }: { report: ProjectFinalReportData }) {
  const { site, period, totals, exceptions, stages, workers, suppliers } = report;
  const projectName = `${reportText(site.nameEn)} / ${reportText(site.nameTh)}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportBrandHeader
          titleEn="Project Final Report"
          titleTh="รายงานสรุปโครงการ"
          date={period.end}
          generatedAt={report.generatedAt}
          hostedCompany={report.hostCompany}
        />

        {/* Top KPIs — real project cost */}
        <ReportKpiGrid>
          <ReportKpiCard labelEn="Total cost" labelTh="ต้นทุนรวม" value={reportMoneyWithCurrency(totals.totalCost)} accent={COLORS.brandViolet} icon="฿" />
          <ReportKpiCard labelEn="Labor" labelTh="ค่าแรง" value={reportMoneyWithCurrency(totals.laborCost)} accent={COLORS.brandPrimary} icon="ก" />
          <ReportKpiCard labelEn="Receipts" labelTh="ใบเสร็จ" value={reportMoneyWithCurrency(totals.receiptCost)} accent={COLORS.brandAccent} icon="R" />
          <ReportKpiCard labelEn="Overtime" labelTh="ล่วงเวลา" value={reportMoneyWithCurrency(totals.overtimeCost)} accent={COLORS.live} icon="OT" />
          <ReportKpiCard labelEn="Worker-days" labelTh="วันทำงาน" value={reportMoney(totals.workerDays)} accent={COLORS.success} icon="วัน" />
          <ReportKpiCard labelEn="Workers" labelTh="คนงาน" value={reportMoney(totals.uniqueWorkers)} accent={COLORS.blueSignal} icon="คน" />
        </ReportKpiGrid>

        {/* Project summary */}
        <ReportSection title="Project / โครงการ" subtitle={reportText(site.description) || undefined}>
          <ReportKeyValueGrid>
            <ReportKeyValue labelEn="Name" labelTh="ชื่อ" value={truncateReportText(projectName, 40)} />
            <ReportKeyValue labelEn="Type" labelTh="ประเภท" value={site.projectType === "long" ? "Long / ยาว" : "Short / สั้น"} />
            <ReportKeyValue labelEn="Status" labelTh="สถานะ" value={closeReasonLabel(site.closeReason, site.isClosed)} color={site.isClosed ? COLORS.success : COLORS.live} />
          </ReportKeyValueGrid>
          <ReportKeyValueGrid>
            <ReportKeyValue labelEn="Start" labelTh="เริ่ม" value={reportText(period.start)} />
            <ReportKeyValue labelEn="End" labelTh="สิ้นสุด" value={reportText(period.end)} />
            <ReportKeyValue labelEn="Duration" labelTh="ระยะเวลา" value={`${reportMoney(period.durationDays)} days / วัน`} />
          </ReportKeyValueGrid>
        </ReportSection>

        {/* Stages (long projects) */}
        {stages.length > 0 && (
          <ReportSection title="Stages / ขั้นตอน" subtitle={`${stages.length} stages`}>
            {stages.map((s) => (
              <View key={s.id} style={styles.stageRow} wrap={false}>
                <View style={[styles.stageDot, { backgroundColor: s.color }]} />
                <Text style={styles.stageName}>{truncateReportText(`${s.nameEn || s.nameTh}`, 36)}</Text>
                <Text style={styles.stageMeta}>{reportText(s.periodFrom)} → {reportText(s.periodTo)} · {reportMoney(s.workDays)}d</Text>
                <Text style={styles.stageCost}>{reportMoneyWithCurrency(s.totalCost)}</Text>
              </View>
            ))}
          </ReportSection>
        )}

        {/* Workers breakdown */}
        {workers.length > 0 && (
          <ReportSection title="Workers / คนงาน" subtitle="By total cost">
            {workers.slice(0, 12).map((w) => (
              <ReportSignalRow
                key={w.id}
                color={COLORS.brandPrimary}
                title={`${reportText(w.nameEn || w.nameTh)} — ${reportMoneyWithCurrency(w.totalCost)}`}
                detail={`${reportMoney(w.days)} days · labor ${reportMoneyWithCurrency(w.laborCost)} · OT ${reportMoneyWithCurrency(w.overtimeCost)}`}
              />
            ))}
          </ReportSection>
        )}

        {/* Suppliers breakdown */}
        {suppliers.length > 0 && (
          <ReportSection title="Suppliers / ผู้ขาย" subtitle="By receipt total">
            {suppliers.slice(0, 10).map((s) => (
              <ReportSignalRow
                key={s.id}
                color={COLORS.brandAccent}
                title={`${reportText(s.nameEn || s.nameTh)} — ${reportMoneyWithCurrency(s.receiptCost)}`}
                detail={`${reportMoney(s.count)} receipts`}
              />
            ))}
          </ReportSection>
        )}

        {/* Exceptions summary */}
        <ReportSection title="Exceptions / ข้อยกเว้น" subtitle="Counts over the project lifetime">
          <ReportKeyValueGrid>
            <ReportKeyValue labelEn="Late" labelTh="สาย" value={reportMoney(exceptions.lateCount)} color={exceptions.lateCount > 0 ? COLORS.warning : undefined} />
            <ReportKeyValue labelEn="Half days" labelTh="ครึ่งวัน" value={reportMoney(exceptions.halfDayCount)} />
            <ReportKeyValue labelEn="Missing" labelTh="ขาด" value={reportMoney(exceptions.missingCount)} color={exceptions.missingCount > 0 ? COLORS.danger : undefined} />
          </ReportKeyValueGrid>
          <ReportKeyValueGrid>
            <ReportKeyValue labelEn="Corrections" labelTh="การแก้ไข" value={reportMoney(exceptions.correctionCount)} />
            <ReportKeyValue labelEn="Receipt issues" labelTh="ใบเสร็จมีปัญหา" value={reportMoney(exceptions.receiptIssueCount)} color={exceptions.receiptIssueCount > 0 ? COLORS.brandAccent : undefined} />
            <ReportKeyValue labelEn="GPS issues" labelTh="ปัญหา GPS" value={reportMoney(exceptions.gpsIssueCount)} />
          </ReportKeyValueGrid>
        </ReportSection>

        <View style={styles.footer} fixed>
          <Text>Workforce · Driven by Proof</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function generateProjectFinalReportPdf(report: ProjectFinalReportData): Promise<Buffer> {
  registerReportFonts();
  return renderToBuffer(<ProjectFinalDocument report={report} />);
}
