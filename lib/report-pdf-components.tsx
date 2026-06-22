import path from "node:path";
import React from "react";
import {
  Circle,
  Font,
  Image,
  Line,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

export type HostedCompanyBrand = {
  name?: string | null;
  logoUrl?: string | null;
};

export type ReportBrandHeaderProps = {
  titleEn: string;
  titleTh: string;
  date: string;
  generatedAt: string;
  hostedCompany?: HostedCompanyBrand | null;
};

export type ReportSeverity = "High" | "Medium" | "Low";

export const REPORT_COLORS = {
  brandPrimary: "#1E3A8A",
  brandViolet: "#6C5CE7",
  brandAccent: "#FF6A00",
  lavender: "#F2F4FF",
  surface: "#F5F6FA",
  border: "#E5E7EB",
  textPrimary: "#1E3A8A",
  textSecondary: "#374151",
  textMuted: "#6B7280",
  live: "#06B6D4",
  success: "#22C55E",
  blueSignal: "#3B82F6",
  warning: "#FACC15",
  danger: "#FF4444",
  dangerPurple: "#8B5CF6",
  inactive: "#9CA3AF",
  white: "#FFFFFF",
};

export const REPORT_FONT_FAMILY = "NotoSansThai";

let fontsRegistered = false;

export function registerReportFonts() {
  if (fontsRegistered) return;

  const fontDir = path.join(process.cwd(), "node_modules", "@fontsource", "noto-sans-thai", "files");
  Font.register({
    family: REPORT_FONT_FAMILY,
    fonts: [
      { src: path.join(fontDir, "noto-sans-thai-thai-400-normal.woff"), fontWeight: 400 },
      { src: path.join(fontDir, "noto-sans-thai-thai-600-normal.woff"), fontWeight: 600 },
      { src: path.join(fontDir, "noto-sans-thai-thai-700-normal.woff"), fontWeight: 700 },
    ],
  });

  fontsRegistered = true;
}

export function reportMoney(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function reportMoneyWithCurrency(value: number): string {
  return `THB ${reportMoney(value)}`;
}

export function reportText(value: string | number | null | undefined): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

export function reportDateParts(date: string, generatedAt: string) {
  const [yearRaw, monthRaw, dayRaw] = date.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(yearRaw, (monthRaw || 1) - 1, dayRaw || 1));
  const day = dayRaw || parsedDate.getUTCDate();
  const month = parsedDate.toLocaleDateString("en-US", { month: "long", timeZone: "Asia/Bangkok" });
  const year = yearRaw || parsedDate.getUTCFullYear();
  const thaiDate = parsedDate.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
  const generatedEn = new Date(generatedAt).toLocaleString("en-US", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
  const generatedTh = new Date(generatedAt).toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });

  return {
    dateLine: `${day} ${month} ${year} / ${thaiDate}`,
    generatedLine: `Generated ${generatedEn} Bangkok`,
    generatedThaiLine: `สร้างเมื่อ ${generatedTh} กรุงเทพฯ`,
  };
}

const sharedStyles = StyleSheet.create({
  header: {
    margin: -26,
    marginBottom: 20,
    paddingTop: 26,
    paddingRight: 26,
    paddingBottom: 22,
    paddingLeft: 26,
    backgroundColor: REPORT_COLORS.lavender,
    borderBottomWidth: 4,
    borderBottomColor: REPORT_COLORS.brandAccent,
    borderLeftWidth: 7,
    borderLeftColor: REPORT_COLORS.brandViolet,
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
  brandMark: {
    width: 64,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  logoTextBlock: {
    flexDirection: "column",
  },
  logoWord: {
    color: REPORT_COLORS.textPrimary,
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.05,
  },
  logoTagline: {
    marginTop: 4,
    color: REPORT_COLORS.brandAccent,
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
    backgroundColor: REPORT_COLORS.white,
  },
  clientLogoEyebrow: {
    color: REPORT_COLORS.textMuted,
    fontSize: 6.8,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  clientLogoFrame: {
    marginTop: 4,
    height: 24,
    borderRadius: 5,
    backgroundColor: REPORT_COLORS.surface,
    borderWidth: 1,
    borderColor: REPORT_COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  clientLogoName: {
    color: REPORT_COLORS.textPrimary,
    fontSize: 9.2,
    fontWeight: 700,
    lineHeight: 1.2,
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
  titleBlock: {
    flex: 1,
  },
  title: {
    color: REPORT_COLORS.textPrimary,
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.12,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
  },
  metaText: {
    color: REPORT_COLORS.textPrimary,
    fontSize: 10.8,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  metaSub: {
    color: REPORT_COLORS.textMuted,
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
    backgroundColor: REPORT_COLORS.white,
    borderWidth: 1,
    borderColor: REPORT_COLORS.border,
    borderRadius: 7,
  },
  kpiIcon: {
    position: "absolute",
    left: 13,
    top: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    color: REPORT_COLORS.white,
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
    color: REPORT_COLORS.textMuted,
    fontSize: 8,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  kpiValue: {
    marginTop: 6,
    color: REPORT_COLORS.textPrimary,
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.05,
  },
  section: {
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: REPORT_COLORS.border,
    borderRadius: 7,
    backgroundColor: REPORT_COLORS.white,
  },
  sectionHeader: {
    marginBottom: 5,
    color: REPORT_COLORS.textPrimary,
    fontSize: 15.2,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  sectionSub: {
    color: REPORT_COLORS.textMuted,
    fontSize: 8.4,
    fontWeight: 500,
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
    borderColor: REPORT_COLORS.border,
    borderRadius: 6,
    backgroundColor: REPORT_COLORS.surface,
  },
  keyLabel: {
    color: REPORT_COLORS.textMuted,
    fontSize: 7.8,
    fontWeight: 600,
    lineHeight: 1.2,
  },
  keyValueText: {
    marginTop: 4,
    color: REPORT_COLORS.textPrimary,
    fontSize: 10.4,
    fontWeight: 700,
  },
  receiptIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    color: REPORT_COLORS.white,
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 5,
  },
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 5,
    fontSize: 8.4,
    fontWeight: 700,
  },
  severityCell: {
    width: 72,
    paddingVertical: 7,
    paddingHorizontal: 5,
    alignItems: "center",
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
    color: REPORT_COLORS.textPrimary,
    fontSize: 9.8,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  rowDetail: {
    marginTop: 2,
    color: REPORT_COLORS.textMuted,
    fontSize: 8.4,
    lineHeight: 1.28,
  },
});

function WorkforceLogoMark() {
  return (
    <View style={sharedStyles.brandMark}>
      <Svg width={64} height={54} viewBox="0 0 64 54">
        <Path d="M5 10 L17 45 L30 21" stroke={REPORT_COLORS.brandPrimary} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M34 21 L47 45 L59 10" stroke={REPORT_COLORS.brandPrimary} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M32 4 C25 4 20 9 20 16 C20 25 32 37 32 37 C32 37 44 25 44 16 C44 9 39 4 32 4 Z" fill={REPORT_COLORS.brandAccent} />
        <Circle cx={32} cy={16} r={7} fill={REPORT_COLORS.white} />
        <Line x1={32} y1={16} x2={32} y2={11} stroke={REPORT_COLORS.brandPrimary} strokeWidth={1.8} strokeLinecap="round" />
        <Line x1={32} y1={16} x2={36} y2={18.5} stroke={REPORT_COLORS.brandPrimary} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function HostedCompanyMark({ company }: { company?: HostedCompanyBrand | null }) {
  const name = reportText(company?.name) || "Client logo / โลโก้บริษัท";
  const logoUrl = reportText(company?.logoUrl);

  return (
    <View style={sharedStyles.clientLogoSlot}>
      <Text style={sharedStyles.clientLogoEyebrow}>Prepared for / สำหรับบริษัท</Text>
      <View style={sharedStyles.clientLogoFrame}>
        {logoUrl ? (
          <Image src={logoUrl} style={sharedStyles.clientLogoImage} />
        ) : (
          <Text style={sharedStyles.clientLogoName}>{name}</Text>
        )}
      </View>
    </View>
  );
}

export function ReportBrandHeader({
  titleEn,
  titleTh,
  date,
  generatedAt,
  hostedCompany,
}: ReportBrandHeaderProps) {
  const dateParts = reportDateParts(date, generatedAt);

  return (
    <View style={sharedStyles.header}>
      <View style={sharedStyles.headerRow}>
        <View style={sharedStyles.logoLockup}>
          <View style={sharedStyles.logoMainRow}>
            <WorkforceLogoMark />
            <View style={sharedStyles.logoTextBlock}>
              <Text style={sharedStyles.logoWord}>Workforce</Text>
              <Text style={sharedStyles.logoTagline}>Driven by Proof</Text>
            </View>
          </View>
          <HostedCompanyMark company={hostedCompany} />
        </View>

        <View style={sharedStyles.headerDivider} />

        <View style={sharedStyles.titleBlock}>
          <Text style={sharedStyles.title}>{titleEn} / {titleTh}</Text>
          <View style={sharedStyles.metaLine}>
            <Text style={sharedStyles.metaText}>{dateParts.dateLine}</Text>
          </View>
          <View style={sharedStyles.metaLine}>
            <View>
              <Text style={sharedStyles.metaText}>{dateParts.generatedLine}</Text>
              <Text style={sharedStyles.metaSub}>{dateParts.generatedThaiLine}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export function ReportBilingualLabel({ en, th }: { en: string; th: string }) {
  return (
    <Text>
      {en}
      {"\n"}
      {th}
    </Text>
  );
}

export function ReportKpiGrid({ children }: { children: React.ReactNode }) {
  return <View style={sharedStyles.kpiGrid}>{children}</View>;
}

export function ReportKpiCard({
  labelEn,
  labelTh,
  value,
  accent,
  icon,
}: {
  labelEn: string;
  labelTh: string;
  value: string;
  accent: string;
  icon: string;
}) {
  return (
    <View style={sharedStyles.kpiCard}>
      <View style={[sharedStyles.kpiAccent, { backgroundColor: accent }]} />
      <View style={[sharedStyles.kpiIcon, { backgroundColor: accent }]}>
        <Text>{icon}</Text>
      </View>
      <Text style={sharedStyles.kpiLabel}>
        <ReportBilingualLabel en={labelEn} th={labelTh} />
      </Text>
      <Text style={[sharedStyles.kpiValue, { color: accent === REPORT_COLORS.warning ? REPORT_COLORS.warning : accent }]}>{value}</Text>
    </View>
  );
}

export function ReportSection({
  title,
  subtitle,
  children,
  wrap = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wrap?: boolean;
}) {
  const [titleEn, titleTh] = title.split(" / ");
  return (
    <View style={sharedStyles.section} wrap={wrap}>
      <Text style={sharedStyles.sectionHeader}>{titleTh ? `${titleEn} / ${titleTh}` : titleEn}</Text>
      {subtitle ? <Text style={sharedStyles.sectionSub}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export function ReportKeyValueGrid({ children }: { children: React.ReactNode }) {
  return <View style={sharedStyles.keyValueGrid}>{children}</View>;
}

export function ReportKeyValue({
  labelEn,
  labelTh,
  value,
  color,
}: {
  labelEn: string;
  labelTh: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={sharedStyles.keyValue} wrap={false}>
      <Text style={sharedStyles.keyLabel}>
        {labelEn}
        {"\n"}
        {labelTh}
      </Text>
      <Text style={color ? [sharedStyles.keyValueText, { color }] : sharedStyles.keyValueText}>{value}</Text>
    </View>
  );
}

export function ReportCircleBadge({ color, label }: { color: string; label: string }) {
  return (
    <View style={[sharedStyles.receiptIcon, { backgroundColor: color }]}>
      <Text>{label}</Text>
    </View>
  );
}

export function ReportSeverityChip({ level }: { level: ReportSeverity }) {
  const color = level === "High" ? REPORT_COLORS.danger : level === "Medium" ? REPORT_COLORS.brandAccent : REPORT_COLORS.blueSignal;
  const th = level === "High" ? "สูง" : level === "Medium" ? "ปานกลาง" : "ต่ำ";

  return (
    <View style={sharedStyles.severityCell}>
      <Text style={[sharedStyles.chip, { color, borderColor: color }]}>{level}</Text>
      <Text style={[sharedStyles.rowDetail, { color, marginTop: 2 }]}>{th}</Text>
    </View>
  );
}

export function ReportSignalRow({
  color,
  title,
  detail,
}: {
  color: string;
  title: string;
  detail?: string;
}) {
  return (
    <View style={sharedStyles.row}>
      <View style={[sharedStyles.marker, { backgroundColor: color }]} />
      <View style={sharedStyles.rowMain}>
        <Text style={sharedStyles.rowTitle}>{truncateReportText(title, 110)}</Text>
        {detail ? <Text style={sharedStyles.rowDetail}>{truncateReportText(detail, 140)}</Text> : null}
      </View>
    </View>
  );
}

export function truncateReportText(value: string | number | null | undefined, max = 88): string {
  const clean = reportText(value);
  return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean;
}
