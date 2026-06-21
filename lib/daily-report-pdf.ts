import type { DailyReportData, SiteReportData } from "@/lib/daily-report";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 44;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 46;

type PdfPage = {
  lines: PdfLine[];
};

type PdfLine = {
  text: string;
  x: number;
  y: number;
  size: number;
  weight?: "bold";
};

function money(value: number): string {
  return `THB ${Math.round(value).toLocaleString("en-US")}`;
}

function cleanPdfText(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  return text
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function siteName(site: SiteReportData): string {
  return cleanPdfText(site.siteNameEn || site.siteNameTh || "Unnamed site");
}

function escapePdfText(value: string): string {
  return cleanPdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

class DailyReportPdfBuilder {
  private pages: PdfPage[] = [{ lines: [] }];
  private y = MARGIN_TOP;

  private get page() {
    return this.pages[this.pages.length - 1];
  }

  line(text: string, options: { size?: number; weight?: "bold"; gap?: number; x?: number } = {}) {
    const size = options.size ?? 10;
    const gap = options.gap ?? size + 5;
    if (this.y + gap > PAGE_HEIGHT - MARGIN_BOTTOM) {
      this.pages.push({ lines: [] });
      this.y = MARGIN_TOP;
    }
    this.page.lines.push({
      text,
      x: options.x ?? MARGIN_X,
      y: PAGE_HEIGHT - this.y,
      size,
      weight: options.weight,
    });
    this.y += gap;
  }

  spacer(amount = 8) {
    this.y += amount;
  }

  section(title: string) {
    this.spacer(6);
    this.line(title, { size: 13, weight: "bold", gap: 18 });
  }

  build(): Buffer {
    return writePdf(this.pages);
  }
}

function writePdf(pages: PdfPage[]): Buffer {
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds: number[] = [];

  for (const page of pages) {
    const stream = page.lines
      .map((line) => {
        const font = line.weight === "bold" ? "F2" : "F1";
        return `BT /${font} ${line.size} Tf ${line.x.toFixed(2)} ${line.y.toFixed(2)} Td (${escapePdfText(line.text)}) Tj ET`;
      })
      .join("\n");
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> ` +
        `/Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  const pagesId = addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  for (const pageId of pageIds) {
    objects[pageId - 1] = objects[pageId - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  }

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function addSiteSummary(pdf: DailyReportPdfBuilder, site: SiteReportData) {
  pdf.line(
    `${siteName(site)} | workers ${site.presentCount} | late ${site.lateCount} | receipts ${money(site.receiptTotal)} | total ${money(site.totalSiteCost)}`,
    { size: 10, gap: 15 }
  );
}

export function generateDailyReportPdf(report: DailyReportData): Buffer {
  const pdf = new DailyReportPdfBuilder();
  const { totals } = report;

  pdf.line("Workforce Daily Report", { size: 22, weight: "bold", gap: 28 });
  pdf.line(`Date: ${report.date}`, { size: 12, gap: 17 });
  pdf.line(`Generated: ${new Date(report.generatedAt).toLocaleString("en-US", { timeZone: "Asia/Bangkok" })} Bangkok`, {
    size: 10,
    gap: 22,
  });

  pdf.section("Owner summary");
  pdf.line(`Workers reported: ${totals.totalPresent}`, { size: 11 });
  pdf.line(`Late workers: ${totals.totalLate}`, { size: 11 });
  pdf.line(`Not reported / missing: ${totals.totalMissing}`, { size: 11 });
  pdf.line(`Transfers: ${totals.totalTransfers}`, { size: 11 });
  pdf.line(`Labor cost: ${money(totals.totalLaborCost)}`, { size: 11 });
  pdf.line(`Receipt cost: ${money(totals.totalReceiptAmount)}`, { size: 11 });
  pdf.line(`Grand total: ${money(totals.totalExpenses)}`, { size: 12, weight: "bold", gap: 18 });

  if (report.blockReasons.length > 0) {
    pdf.section("Blocking issues");
    for (const reason of report.blockReasons) {
      pdf.line(`- ${reason.messageEn}`, { size: 10 });
    }
  }

  const activeSites = report.sites.filter((site) => site.presentCount > 0 || site.receipts.length > 0);
  pdf.section("Site summary");
  if (activeSites.length === 0) {
    pdf.line("No site activity recorded today.", { size: 10 });
  } else {
    activeSites.forEach((site) => addSiteSummary(pdf, site));
  }

  const lateWorkers = report.sites.flatMap((site) =>
    site.workers
      .filter((worker) => worker.isLate)
      .map((worker) => `${cleanPdfText(worker.nameEn || worker.nameTh)} at ${siteName(site)} (${worker.arrivalTime ?? "no time"})`)
  );
  if (lateWorkers.length > 0) {
    pdf.section("Late workers");
    lateWorkers.forEach((worker) => pdf.line(`- ${worker}`, { size: 10 }));
  }

  const receiptIssues = report.sites.flatMap((site) =>
    site.receipts
      .filter((receipt) => !["paid", "approved"].includes(receipt.status))
      .map((receipt) => `${siteName(site)} | ${cleanPdfText(receipt.supplierNameTh ?? "Unknown supplier")} | ${receipt.status}`)
  );
  if (receiptIssues.length > 0) {
    pdf.section("Receipt issues");
    receiptIssues.forEach((issue) => pdf.line(`- ${issue}`, { size: 10 }));
  }

  if (report.corrections.length > 0) {
    pdf.section("Corrections today");
    for (const correction of report.corrections) {
      pdf.line(
        `- ${correction.entityType}.${correction.fieldName}: ${correction.originalValue ?? "-"} -> ${correction.correctedValue ?? "-"}`,
        { size: 10 }
      );
    }
  }

  pdf.section("Cost categories");
  report.expenseCategories.slice(0, 8).forEach((category, index) => {
    pdf.line(`${index + 1}. ${cleanPdfText(category.nameTh || category.category)} | ${money(category.amount)} | score ${category.severityScore.toFixed(1)}`, {
      size: 10,
    });
  });

  return pdf.build();
}
