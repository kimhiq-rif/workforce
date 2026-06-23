// Copyright © 2026 Workforce. All rights reserved.
// Annual / Half-year "big document" PDF — server-rendered, consistent with the
// other report PDFs (replaces the client window.print fallback).
import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { AnnualReportData, AnnualReportMetric, AnnualReportRankedItem } from "@/lib/annual-report";
import {
  REPORT_COLORS,
  REPORT_FONT_FAMILY,
  ReportBrandHeader,
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
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  monthName: { flex: 1, fontSize: 9.5, fontWeight: 700, color: COLORS.textPrimary },
  monthCost: { width: 95, textAlign: "right", fontSize: 9.5, fontWeight: 700, color: COLORS.textPrimary },
  monthMeta: { width: 150, textAlign: "right", fontSize: 8.2, color: COLORS.textMuted },
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

function metricValue(m: AnnualReportMetric): string {
  if (m.unit === "thb") return reportMoneyWithCurrency(m.value);
  if (m.unit === "days") return `${reportMoney(m.value)} days`;
  return reportMoney(m.value);
}

function rankedDetail(item: AnnualReportRankedItem): string {
  const parts: string[] = [];
  if (item.laborCost) parts.push(`labor ${reportMoneyWithCurrency(item.laborCost)}`);
  if (item.receiptCost) parts.push(`receipts ${reportMoneyWithCurrency(item.receiptCost)}`);
  if (item.overtimeCost) parts.push(`OT ${reportMoneyWithCurrency(item.overtimeCost)}`);
  if (item.count) parts.push(`${reportMoney(item.count)}×`);
  if (item.evidencePath?.length) parts.push(item.evidencePath.slice(0, 4).join(" → "));
  return parts.join(" · ");
}

function AnnualDocument({ report }: { report: AnnualReportData }) {
  const { period, totals, topCostDrivers, topTimeDrains, repeatedExceptions, peakMonths, projects, suppliers, workers } = report;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportBrandHeader
          titleEn={period.mode === "annual" ? "Annual Report" : "Half-year Report"}
          titleTh={period.mode === "annual" ? "รายงานประจำปี" : "รายงานครึ่งปี"}
          date={period.end}
          generatedAt={report.generatedAt}
          hostedCompany={report.hostCompany}
        />

        <ReportKpiGrid>
          <ReportKpiCard labelEn="Total cost" labelTh="ต้นทุนรวม" value={reportMoneyWithCurrency(totals.totalCost)} accent={COLORS.brandViolet} icon="฿" />
          <ReportKpiCard labelEn="Labor" labelTh="ค่าแรง" value={reportMoneyWithCurrency(totals.laborCost)} accent={COLORS.brandPrimary} icon="ก" />
          <ReportKpiCard labelEn="Receipts" labelTh="ใบเสร็จ" value={reportMoneyWithCurrency(totals.receiptCost)} accent={COLORS.brandAccent} icon="R" />
          <ReportKpiCard labelEn="Overtime" labelTh="ล่วงเวลา" value={reportMoneyWithCurrency(totals.overtimeCost)} accent={COLORS.live} icon="OT" />
          <ReportKpiCard labelEn="Worker-days" labelTh="วันทำงาน" value={reportMoney(totals.workerDays)} accent={COLORS.success} icon="วัน" />
          <ReportKpiCard labelEn="Workers" labelTh="คนงาน" value={reportMoney(totals.uniqueWorkers)} accent={COLORS.blueSignal} icon="คน" />
        </ReportKpiGrid>

        {topCostDrivers.length > 0 && (
          <ReportSection title="Top cost drivers / ต้นทุนหลัก">
            {topCostDrivers.map((m) => (
              <ReportSignalRow key={m.key} color={COLORS.brandViolet} title={`${reportText(m.label)} — ${metricValue(m)}`} detail={m.relatedData.join(" · ")} />
            ))}
          </ReportSection>
        )}

        {topTimeDrains.length > 0 && (
          <ReportSection title="Time drains / เวลาที่สูญเสีย">
            {topTimeDrains.map((m) => (
              <ReportSignalRow key={m.key} color={COLORS.brandAccent} title={`${reportText(m.label)} — ${metricValue(m)}`} detail={m.relatedData.join(" · ")} />
            ))}
          </ReportSection>
        )}

        {repeatedExceptions.length > 0 && (
          <ReportSection title="Repeated exceptions / ข้อยกเว้นซ้ำ">
            {repeatedExceptions.map((m) => (
              <ReportSignalRow key={m.key} color={COLORS.danger} title={`${reportText(m.label)} — ${metricValue(m)}`} detail={m.relatedData.join(" · ")} />
            ))}
          </ReportSection>
        )}

        {peakMonths.length > 0 && (
          <ReportSection title="Peak months / เดือนที่สูงสุด">
            {peakMonths.map((mo) => (
              <View key={mo.month} style={styles.monthRow} wrap={false}>
                <Text style={styles.monthName}>{reportText(mo.label)}</Text>
                <Text style={styles.monthMeta}>{reportMoney(mo.workerDays)}d · late {reportMoney(mo.lateCount)} · issues {reportMoney(mo.receiptIssueCount + mo.correctionCount)}</Text>
                <Text style={styles.monthCost}>{reportMoneyWithCurrency(mo.totalCost)}</Text>
              </View>
            ))}
          </ReportSection>
        )}

        {projects.length > 0 && (
          <ReportSection title="Projects / โครงการ" subtitle="By total cost">
            {projects.slice(0, 10).map((p) => (
              <ReportSignalRow key={p.id} color={COLORS.brandPrimary} title={`${reportText(p.nameEn || p.nameTh)} — ${reportMoneyWithCurrency(p.totalCost)}`} detail={truncateReportText(rankedDetail(p), 150)} />
            ))}
          </ReportSection>
        )}

        {suppliers.length > 0 && (
          <ReportSection title="Suppliers / ผู้ขาย" subtitle="By total cost">
            {suppliers.slice(0, 10).map((s) => (
              <ReportSignalRow key={s.id} color={COLORS.brandAccent} title={`${reportText(s.nameEn || s.nameTh)} — ${reportMoneyWithCurrency(s.totalCost)}`} detail={truncateReportText(rankedDetail(s), 150)} />
            ))}
          </ReportSection>
        )}

        {workers.length > 0 && (
          <ReportSection title="Workers / คนงาน" subtitle="By total cost">
            {workers.slice(0, 10).map((w) => (
              <ReportSignalRow key={w.id} color={COLORS.success} title={`${reportText(w.nameEn || w.nameTh)} — ${reportMoneyWithCurrency(w.totalCost)}`} detail={truncateReportText(rankedDetail(w), 150)} />
            ))}
          </ReportSection>
        )}

        <View style={styles.footer} fixed>
          <Text>Workforce · Driven by Proof · {reportText(period.label)}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function generateAnnualReportPdf(report: AnnualReportData): Promise<Buffer> {
  registerReportFonts();
  return renderToBuffer(<AnnualDocument report={report} />);
}
