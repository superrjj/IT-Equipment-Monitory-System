import * as XLSX from "xlsx";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, ImageRun,
  PageOrientation, VerticalAlign, PageBreak,
  HorizontalPositionAlign,
} from "docx";
import { saveAs } from "file-saver";

// ─── Types ────────────────────────────────────────────────────────────────────
export type TicketRow = {
  id: string;
  ticket_number: string | null;
  title: string;
  description: string;
  status: string;
  employee_name: string;
  department_id: string;
  issue_type: string;
  date_submitted: string;
  assigned_to: string[];
  action_taken: string;
  started_at: string | null;
  completed_at: string | null;
};

export type DeptMap = Record<string, string>;

// ─── Constants ────────────────────────────────────────────────────────────────
const ORG_NAME   = "Tarlac City Government";
const ORG_SUB    = "Information Technology Division";
const BRAND_HEX  = "0A4C86";
const ACCENT_HEX = "1E3A5F";
const LIGHT_HEX  = "EBF2FA";
const WHITE_HEX  = "FFFFFF";
const TNR        = "Times New Roman";
const MAX_ROWS_PER_PAGE = 12;

// ─── Shared Helpers ───────────────────────────────────────────────────────────
export const fmtDate = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        year: "numeric", month: "2-digit", day: "2-digit",
        timeZone: "Asia/Manila",
      })
    : "—";

export const getMonthYear = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric", month: "long", timeZone: "Asia/Manila",
      })
    : "Unknown";

export const monthSortKey = (m: string): number =>
  m === "Unknown" ? 0 : new Date(m).getTime() || 0;

const todayLong = (): string =>
  new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    timeZone: "Asia/Manila",
  });

const groupByMonth = (rows: TicketRow[]): Record<string, TicketRow[]> => {
  const grouped: Record<string, TicketRow[]> = {};
  rows.forEach((r) => {
    const m = getMonthYear(r.completed_at);
    if (!grouped[m]) grouped[m] = [];
    grouped[m].push(r);
  });
  return grouped;
};

// selectedMonths: empty array = all months
const getMonths = (
  grouped: Record<string, TicketRow[]>,
  selectedMonths: string[]
): string[] => {
  const all = Object.keys(grouped).sort((a, b) => monthSortKey(b) - monthSortKey(a));
  if (selectedMonths.length === 0) return all;
  return all.filter((m) => selectedMonths.includes(m));
};

// Build a human-readable period label
export const buildPeriodLabel = (monthKeys: string[]): string => {
  if (monthKeys.length === 0) return "All Months";
  const sorted = [...monthKeys].sort((a, b) => monthSortKey(a) - monthSortKey(b));
  return sorted.length === 1
    ? sorted[0]
    : `${sorted[0]} – ${sorted[sorted.length - 1]}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export function exportToExcel(
  rows: TicketRow[],
  depts: DeptMap,
  selectedMonths: string[]  // empty = all months
): void {
  const wb      = XLSX.utils.book_new();
  const grouped = groupByMonth(rows);
  const months  = getMonths(grouped, selectedMonths);

  const thin = {
    top:    { style: "thin", color: { rgb: "CBD5E1" } },
    bottom: { style: "thin", color: { rgb: "CBD5E1" } },
    left:   { style: "thin", color: { rgb: "CBD5E1" } },
    right:  { style: "thin", color: { rgb: "CBD5E1" } },
  } as any;

  const noBorder = {
    top: { style: "none" }, bottom: { style: "none" },
    left: { style: "none" }, right: { style: "none" },
  } as any;

  const fill  = (rgb: string) => ({ patternType: "solid", fgColor: { rgb } } as any);
  const font  = (bold: boolean, rgb: string, sz: number, italic = false) =>
    ({ bold, italic, color: { rgb }, name: TNR, sz } as any);
  const align = (h: "left" | "center" | "right", wrap = true) =>
    ({ horizontal: h, vertical: "center", wrapText: wrap } as any);
  const C = (v: any, f: any, fi: any, al: any, border: any = thin) =>
    ({ v, t: "s", s: { font: f, fill: fi, alignment: al, border } });
  const blank = (fi: any) =>
    C("", font(false, "1F2937", 10), fi, align("left"), noBorder);

  const COLS = [
    { label: "Ticket No.",     wch: 14 },
    { label: "Problem",        wch: 30 },
    { label: "Name",           wch: 22 },
    { label: "Office",         wch: 26 },
    { label: "Issue Type",     wch: 20 },
    { label: "Description",    wch: 34 },
    { label: "Action Taken",   wch: 34 },
    { label: "Date Submitted", wch: 18 },
    { label: "Date Started",   wch: 18 },
    { label: "Date Resolved",  wch: 18 },
  ];
  const NC = COLS.length;

  months.forEach((month) => {
    const tickets   = grouped[month] ?? [];
    const sheetName = month.replace(/[:\\\/\[\]\?\*]/g, "-").slice(0, 31);
    const aoa: any[][] = [];

    aoa.push([
      C("REPUBLIC OF THE PHILIPPINES", font(false, "475569", 10, true), fill(WHITE_HEX), align("center"), noBorder),
      ...Array(NC - 1).fill(blank(fill(WHITE_HEX))),
    ]);
    aoa.push([
      C(ORG_NAME.toUpperCase(), font(true, BRAND_HEX, 18), fill(WHITE_HEX), align("center"), noBorder),
      ...Array(NC - 1).fill(blank(fill(WHITE_HEX))),
    ]);
    aoa.push([
      C(ORG_SUB.toUpperCase(), font(true, BRAND_HEX, 13), fill(WHITE_HEX), align("center"), noBorder),
      ...Array(NC - 1).fill(blank(fill(WHITE_HEX))),
    ]);
    aoa.push(Array(NC).fill(blank(fill("E2E8F0"))));
    aoa.push([
      C("RESOLVED TICKETS REPORT", font(true, WHITE_HEX, 14), fill(ACCENT_HEX), align("center"), noBorder),
      ...Array(NC - 1).fill(C("", font(true, WHITE_HEX, 14), fill(ACCENT_HEX), align("center"), noBorder)),
    ]);
    aoa.push([
      C(`Period: ${month}`, font(false, "475569", 10), fill(LIGHT_HEX), align("left"), noBorder),
      ...Array(3).fill(blank(fill(LIGHT_HEX))),
      C(`Total Resolved: ${tickets.length}`, font(true, BRAND_HEX, 10), fill(LIGHT_HEX), align("center"), noBorder),
      blank(fill(LIGHT_HEX)),
      blank(fill(LIGHT_HEX)),
      C(`Generated: ${todayLong()}`, font(false, "475569", 10), fill(LIGHT_HEX), align("right"), noBorder),
      blank(fill(LIGHT_HEX)),
      blank(fill(LIGHT_HEX)),
    ]);
    aoa.push(Array(NC).fill(blank(fill(WHITE_HEX))));
    aoa.push(COLS.map(({ label }) =>
      C(label, font(true, WHITE_HEX, 11), fill(ACCENT_HEX), align("center"), thin)
    ));

    tickets.forEach((r, i) => {
      const fi = fill(i % 2 === 0 ? WHITE_HEX : LIGHT_HEX);
      aoa.push([
        C(r.ticket_number?.trim() || `TKT-${r.id.slice(0, 8).toUpperCase()}`, font(true,  BRAND_HEX, 10), fi, align("center"), thin),
        C(r.title,                       font(false, "1F2937", 10), fi, align("left"),   thin),
        C(r.employee_name,               font(false, "1F2937", 10), fi, align("left"),   thin),
        C(depts[r.department_id] ?? "—", font(false, "1F2937", 10), fi, align("left"),   thin),
        C(r.issue_type,                  font(false, "475569", 10), fi, align("center"), thin),
        C(r.description  || "—",         font(false, "1F2937", 10), fi, align("left"),   thin),
        C(r.action_taken || "—",         font(false, "1F2937", 10), fi, align("left"),   thin),
        C(fmtDate(r.date_submitted),     font(false, "475569", 10), fi, align("center"), thin),
        C(fmtDate(r.started_at),         font(false, "475569", 10), fi, align("center"), thin),
        C(fmtDate(r.completed_at),       font(true,  BRAND_HEX, 10), fi, align("center"), thin),
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: NC - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: NC - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: NC - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: NC - 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: NC - 1 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: 3 } },
      { s: { r: 5, c: 4 }, e: { r: 5, c: 6 } },
      { s: { r: 5, c: 7 }, e: { r: 5, c: NC - 1 } },
      { s: { r: 6, c: 0 }, e: { r: 6, c: NC - 1 } },
    ];
    ws["!rows"] = [
      { hpt: 16 }, { hpt: 28 }, { hpt: 20 }, { hpt: 4 },
      { hpt: 26 }, { hpt: 18 }, { hpt: 6  }, { hpt: 22 },
      ...tickets.map(() => ({ hpt: 40 })),
    ];
    ws["!cols"] = COLS.map(({ wch }) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // ── Summary sheet ───────────────────────────────────────────────────────────
  const allMonths = Object.keys(groupByMonth(rows)).sort(
    (a, b) => monthSortKey(b) - monthSortKey(a)
  );
  const sumAoa: any[][] = [];
  const SC = 3;

  const s = (v: any, f: any, fi: any, al: any, border?: any) =>
    ({ v, t: "s", s: { font: f, fill: fi, alignment: al, border: border ?? {} } });

  sumAoa.push([
    s(ORG_NAME.toUpperCase(), font(true, BRAND_HEX, 15), fill(WHITE_HEX), align("center"), noBorder),
    s("", font(false, BRAND_HEX, 15), fill(WHITE_HEX), align("center"), noBorder),
    s("", font(false, BRAND_HEX, 15), fill(WHITE_HEX), align("center"), noBorder),
  ]);
  sumAoa.push([
    s("MONTHLY SUMMARY — RESOLVED TICKETS", font(true, WHITE_HEX, 13), fill(ACCENT_HEX), align("center"), noBorder),
    s("", font(true, WHITE_HEX, 13), fill(ACCENT_HEX), align("center"), noBorder),
    s("", font(true, WHITE_HEX, 13), fill(ACCENT_HEX), align("center"), noBorder),
  ]);
  sumAoa.push([
    s(`Generated: ${todayLong()}`, font(false, "475569", 10), fill(LIGHT_HEX), align("left"), noBorder),
    s("", font(false, "475569", 10), fill(LIGHT_HEX), align("left"), noBorder),
    s("", font(false, "475569", 10), fill(LIGHT_HEX), align("left"), noBorder),
  ]);
  sumAoa.push(Array(SC).fill(s("", font(false, "1F2937", 10), fill(WHITE_HEX), align("left"), noBorder)));
  sumAoa.push([
    s("Month",                  font(true, WHITE_HEX, 11), fill(ACCENT_HEX), align("center"), thin),
    s("Total Resolved Tickets", font(true, WHITE_HEX, 11), fill(ACCENT_HEX), align("center"), thin),
    s("Remarks",                font(true, WHITE_HEX, 11), fill(ACCENT_HEX), align("center"), thin),
  ]);
  allMonths.forEach((m, i) => {
    const fi = fill(i % 2 === 0 ? WHITE_HEX : LIGHT_HEX);
    sumAoa.push([
      s(m,                       font(false, "1F2937", 11), fi, align("left"),   thin),
      s(grouped[m]?.length ?? 0, font(true,  BRAND_HEX, 12), fi, align("center"), thin),
      s("",                      font(false, "1F2937", 11), fi, align("left"),   thin),
    ]);
  });
  sumAoa.push([
    s("TOTAL",     font(true, WHITE_HEX, 12), fill(BRAND_HEX), align("center"), thin),
    s(rows.length, font(true, WHITE_HEX, 14), fill(BRAND_HEX), align("center"), thin),
    s("",          font(true, WHITE_HEX, 12), fill(BRAND_HEX), align("center"), thin),
  ]);

  const sumWs   = XLSX.utils.aoa_to_sheet(sumAoa);
  const lastRow = sumAoa.length - 1;
  sumWs["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
    { s: { r: lastRow, c: 0 }, e: { r: lastRow, c: 0 } },
  ];
  sumWs["!rows"] = [
    { hpt: 26 }, { hpt: 24 }, { hpt: 18 }, { hpt: 6 }, { hpt: 22 },
    ...allMonths.map(() => ({ hpt: 20 })),
    { hpt: 24 },
  ];
  sumWs["!cols"] = [{ wch: 28 }, { wch: 26 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, sumWs, "Summary");

  const label    = buildPeriodLabel(selectedMonths.length > 0 ? selectedMonths : allMonths);
  const filename = `Resolved_Tickets_Report_${label.replace(/[–\s]/g, "_")}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORD EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportToWord(
  rows: TicketRow[],
  depts: DeptMap,
  selectedMonths: string[]  // empty = all months
): Promise<void> {
  const grouped = groupByMonth(rows);
  const months  = getMonths(grouped, selectedMonths);

  const allMonthKeys = Object.keys(grouped).sort((a, b) => monthSortKey(a) - monthSortKey(b));
  const periodLabel  = buildPeriodLabel(
    selectedMonths.length > 0 ? selectedMonths : allMonthKeys
  );

  // ── Fetch logo ──────────────────────────────────────────────────────────────
  let logoRun: ImageRun | null = null;
  try {
    const res  = await fetch(`${window.location.origin}/masaya-sa-tarlac-city.png`);
    const blob = await res.blob();
    const buf  = await blob.arrayBuffer();
    logoRun = new ImageRun({
      data: buf,
      transformation: { width: 300, height: 100 },
      type: "png",
    });
  } catch {
    logoRun = null;
  }

  // ── Borders ─────────────────────────────────────────────────────────────────
  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "BFD4EA" };
  const allBorders = {
    top: cellBorder, bottom: cellBorder,
    left: cellBorder, right: cellBorder,
  };

  // ── Layout ──────────────────────────────────────────────────────────────────
  const TABLE_W = 14800;
  const COL_W   = [1400, 2600, 2600, 2600, 1600, 2800, 1400];

  // ── Cell builders ───────────────────────────────────────────────────────────
  const hCell = (text: string) =>
    new TableCell({
      borders: allBorders,
      shading: { fill: BRAND_HEX, type: ShadingType.CLEAR },
      verticalAlign: HorizontalPositionAlign.CENTER,
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text, bold: true, size: 17, color: WHITE_HEX, font: "Poppins" }),
          ],
        }),
      ],
    });

  const dCell = (
    text: string,
    opts: { center?: boolean; bold?: boolean; color?: string } = {}
  ) =>
    new TableCell({
      borders: allBorders,
      shading: { fill: WHITE_HEX, type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [
        new Paragraph({
          alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [
            new TextRun({
              text,
              bold:  opts.bold  ?? false,
              size:  17,
              color: opts.color ?? "1F2937",
              font:  "Poppins",
            }),
          ],
        }),
      ],
    });

  const children: (Paragraph | Table)[] = [];

  // ── 1. Logo ─────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: logoRun
        ? [logoRun]
        : [new TextRun({ text: "[Logo]", size: 20, italics: true, color: "94A3B8", font: "Poppins" })],
    })
  );

  // ── 2. Division name ────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: "INFORMATION TECHNOLOGY DIVISION",
          bold: true, size: 22, color: BRAND_HEX, font: "Poppins",
        }),
      ],
    })
  );

  // ── 3. Divider ──────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      spacing: { before: 80, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_HEX, space: 1 } },
      children: [],
    })
  );

  // ── 4. Title & meta ─────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 40 },
      children: [
        new TextRun({
          text: "RESOLVED TICKETS REPORT",
          bold: true, size: 26, color: BRAND_HEX, font: "Poppins",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 140 },
      children: [
        new TextRun({ text: `Period: ${periodLabel}`, size: 17, color: "475569", font: "Poppins" }),
        new TextRun({ text: "     •     ", size: 17, color: "CBD5E1", font: "Poppins" }),
        new TextRun({ text: `Total Resolved: ${rows.length}`, bold: true, size: 17, color: BRAND_HEX, font: "Poppins" }),
        new TextRun({ text: "     •     ", size: 17, color: "CBD5E1", font: "Poppins" }),
        new TextRun({ text: `Generated: ${todayLong()}`, size: 17, color: "475569", font: "Poppins" }),
      ],
    })
  );

  // ── 5. Per-month tables ──────────────────────────────────────────────────────
  months.forEach((month) => {
    const tickets = grouped[month] ?? [];

    if (tickets.length === 0) {
      children.push(
        new Paragraph({
          spacing: { after: 180 },
          children: [
            new TextRun({
              text: "No resolved tickets for this period.",
              italics: true, size: 18, color: "9CA3AF", font: "Poppins",
            }),
          ],
        })
      );
      return;
    }

    const chunks: TicketRow[][] = [];
    for (let i = 0; i < tickets.length; i += MAX_ROWS_PER_PAGE) {
      chunks.push(tickets.slice(i, i + MAX_ROWS_PER_PAGE));
    }

    chunks.forEach((chunk, chunkIdx) => {
      if (chunkIdx > 0) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
      }
      children.push(
        new Table({
          width: { size: TABLE_W, type: WidthType.DXA },
          columnWidths: COL_W,
          alignment: AlignmentType.CENTER,
          borders: {
            top:              { style: BorderStyle.SINGLE, size: 8, color: BRAND_HEX },
            bottom:           { style: BorderStyle.SINGLE, size: 8, color: BRAND_HEX },
            left:             { style: BorderStyle.SINGLE, size: 8, color: BRAND_HEX },
            right:            { style: BorderStyle.SINGLE, size: 8, color: BRAND_HEX },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "BFD4EA" },
            insideVertical:   { style: BorderStyle.SINGLE, size: 4, color: "BFD4EA" },
          },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                hCell("Ticket No."),
                hCell("Problem"),
                hCell("Name"),
                hCell("Office"),
                hCell("Issue Type"),
                hCell("Action Taken"),
                hCell("Date Resolved"),
              ],
            }),
            ...chunk.map((r) =>
              new TableRow({
                children: [
                  dCell(
                    r.ticket_number?.trim() || `TKT-${r.id.slice(0, 8).toUpperCase()}`,
                    { center: true, bold: true, color: BRAND_HEX }
                  ),
                  dCell(r.title),
                  dCell(r.employee_name),
                  dCell(depts[r.department_id] ?? "—"),
                  dCell(r.issue_type, { center: true }),
                  dCell(r.action_taken || "—"),
                  dCell(fmtDate(r.completed_at), { center: true, bold: false }),
                ],
              })
            ),
          ],
        })
      );
    });
  });

  // ── 6. Footer ────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      spacing: { before: 500 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0", space: 1 } },
      children: [],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80 },
      children: [
        new TextRun({
          text: `${ORG_NAME} — Information Technology Division • This document is system-generated and for official use only.`,
          size: 17, italics: true, color: "94A3B8", font: "Poppins",
        }),
      ],
    })
  );

  // ── Build document ───────────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children,
    }],
  });

  const buffer   = await Packer.toBlob(doc);
  const filename = `Resolved_Tickets_Report_${periodLabel.replace(/[–\s]/g, "_")}.docx`;
  saveAs(buffer, filename);
}