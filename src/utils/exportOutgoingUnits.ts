import * as XLSX from "xlsx";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, ImageRun,
  PageOrientation, VerticalAlign, PageBreak,
} from "docx";
import { saveAs } from "file-saver";

// ─── Types ────────────────────────────────────────────────────────────────────
export type OutgoingUnitRow = {
  id: string;
  date_released: string;
  unit_name: string;
  collected_by: string;
  released_by_user_id: string | null;
  release_notes: string;
  department_id: string | null;
  created_at: string;
  updated_at: string;
};

/** department_id → display label (e.g. "Parent Office - Sub branch") */
export type DeptDisplayMap = Record<string, string>;

// ─── Constants ────────────────────────────────────────────────────────────────
const ORG_NAME        = "Tarlac City Government";
const ORG_SUB         = "Information Technology Division";
const BRAND_HEX       = "0A4C86";
const ACCENT_HEX      = "1E3A5F";
const LIGHT_HEX       = "EBF2FA";
const WHITE_HEX       = "FFFFFF";
const TNR             = "Times New Roman";
const MAX_ROWS_PER_PAGE = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        year: "numeric", month: "2-digit", day: "2-digit",
        timeZone: "Asia/Manila",
      })
    : "—";

const todayLong = (): string =>
  new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    timeZone: "Asia/Manila",
  });

/** Format a YYYY-MM string to e.g. "March 2025" */
const fmtMonthLabel = (ym: string): string => {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
    year: "numeric", month: "long",
  });
};

/** Filter rows to a given month string "YYYY-MM", or return all if null */
const filterByMonth = (rows: OutgoingUnitRow[], monthFilter: string | null): OutgoingUnitRow[] => {
  if (!monthFilter) return rows;
  return rows.filter(r => r.date_released?.slice(0, 7) === monthFilter);
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export function exportOutgoingUnitsToExcel(
  rows: OutgoingUnitRow[],
  deptDisplayMap: DeptDisplayMap,
  monthFilter: string | null = null
): void {
  const filtered = filterByMonth(rows, monthFilter);
  const monthLabel = monthFilter ? fmtMonthLabel(monthFilter) : "All Records";

  const wb = XLSX.utils.book_new();

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
    { label: "Date Released",    wch: 18 },
    { label: "Unit",             wch: 30 },
    { label: "Name of Employee", wch: 26 },
    { label: "Office",           wch: 40 },
    { label: "Release Notes",  wch: 48 },
  ];
  const NC = COLS.length;

  const aoa: any[][] = [];

  // ── Header rows ─────────────────────────────────────────────────────────────
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
    C("OUTGOING UNITS LOG", font(true, WHITE_HEX, 14), fill(ACCENT_HEX), align("center"), noBorder),
    ...Array(NC - 1).fill(C("", font(true, WHITE_HEX, 14), fill(ACCENT_HEX), align("center"), noBorder)),
  ]);
  aoa.push([
    C(`Period: ${monthLabel}`, font(true, BRAND_HEX, 10), fill(LIGHT_HEX), align("center"), noBorder),
    blank(fill(LIGHT_HEX)),
    C(`Total Records: ${filtered.length}`, font(true, BRAND_HEX, 10), fill(LIGHT_HEX), align("center"), noBorder),
    blank(fill(LIGHT_HEX)),
    C(`Generated: ${todayLong()}`, font(false, "475569", 10), fill(LIGHT_HEX), align("right"), noBorder),
  ]);
  aoa.push(Array(NC).fill(blank(fill(WHITE_HEX))));
  aoa.push(COLS.map(({ label }) =>
    C(label, font(true, WHITE_HEX, 11), fill(ACCENT_HEX), align("center"), thin)
  ));

  // ── Data rows ───────────────────────────────────────────────────────────────
  filtered.forEach((r, i) => {
    const fi = fill(i % 2 === 0 ? WHITE_HEX : LIGHT_HEX);
    aoa.push([
      C(fmtDate(r.date_released),                             font(false, "475569", 10), fi, align("center"), thin),
      C(r.unit_name,                                          font(true,  BRAND_HEX, 10), fi, align("left"),   thin),
      C(r.collected_by,                                        font(false, "1F2937", 10), fi, align("left"),   thin),
      C(deptDisplayMap[r.department_id ?? ""] ?? "—",          font(false, "1F2937", 10), fi, align("left"),   thin),
      C(r.release_notes || "—",                          font(false, "1F2937", 10), fi, align("left"),   thin),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: NC - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: NC - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: NC - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: NC - 1 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: NC - 1 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 1 } },
    { s: { r: 5, c: 2 }, e: { r: 5, c: 3 } },
    { s: { r: 5, c: 4 }, e: { r: 5, c: 4 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: NC - 1 } },
  ];
  ws["!rows"] = [
    { hpt: 16 }, { hpt: 28 }, { hpt: 20 }, { hpt: 4 },
    { hpt: 26 }, { hpt: 18 }, { hpt: 6  }, { hpt: 22 },
    ...filtered.map(() => ({ hpt: 40 })),
  ];
  ws["!cols"] = COLS.map(({ wch }) => ({ wch }));

  XLSX.utils.book_append_sheet(wb, ws, "Outgoing Units");

  const suffix = monthFilter ? `_${monthFilter}` : `_${todayLong().replace(/\//g, "-")}`;
  const filename = `Outgoing_Units_Log${suffix}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORD EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportOutgoingUnitsToWord(
  rows: OutgoingUnitRow[],
  deptDisplayMap: DeptDisplayMap,
  monthFilter: string | null = null
): Promise<void> {
  const filtered = filterByMonth(rows, monthFilter);
  const monthLabel = monthFilter ? fmtMonthLabel(monthFilter) : "All Records";

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
  // Landscape A4 — total usable width at 600 twip margins = 15840 twips
  // Columns: Date | Unit | Name of Employee | Office | Release Notes
  const TABLE_W = 15840;
  const COL_W   = [1600, 2000, 2600, 4200, 5440];

  // ── Cell builders ───────────────────────────────────────────────────────────
  const hCell = (text: string, width: number) =>
    new TableCell({
      borders: allBorders,
      shading: { fill: BRAND_HEX, type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      width: { size: width, type: WidthType.DXA },
      margins: { top: 40, bottom: 40, left: 120, right: 120 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text, bold: true, size: 16, color: WHITE_HEX, font: "Poppins" }),
          ],
        }),
      ],
    });

  const dCell = (
    text: string,
    width: number,
    opts: { center?: boolean; bold?: boolean; color?: string } = {}
  ) =>
    new TableCell({
      borders: allBorders,
      shading: { fill: WHITE_HEX, type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      width: { size: width, type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [
        new Paragraph({
          alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [
            new TextRun({
              text,
              bold:  opts.bold  ?? false,
              size:  16,
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
      spacing: { before: 60, after: 20 },
      children: [
        new TextRun({
          text: "OUTGOING UNITS LOG",
          bold: true, size: 26, color: BRAND_HEX, font: "Poppins",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text: `Period: ${monthLabel}`, bold: true, size: 17, color: BRAND_HEX, font: "Poppins" }),
        new TextRun({ text: "     •     ", size: 17, color: "CBD5E1", font: "Poppins" }),
        new TextRun({ text: `Total Records: ${filtered.length}`, bold: true, size: 17, color: BRAND_HEX, font: "Poppins" }),
        new TextRun({ text: "     •     ", size: 17, color: "CBD5E1", font: "Poppins" }),
        new TextRun({ text: `Generated: ${todayLong()}`, size: 17, color: "475569", font: "Poppins" }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [],
    })
  );

  // ── 5. Table (chunked by MAX_ROWS_PER_PAGE) ──────────────────────────────
  if (filtered.length === 0) {
    children.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: `No outgoing units recorded${monthFilter ? ` for ${monthLabel}` : ""}.`,
            italics: true, size: 18, color: "9CA3AF", font: "Poppins",
          }),
        ],
      })
    );
  } else {
    const chunks: OutgoingUnitRow[][] = [];
    for (let i = 0; i < filtered.length; i += MAX_ROWS_PER_PAGE) {
      chunks.push(filtered.slice(i, i + MAX_ROWS_PER_PAGE));
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
            // ── Header row ───────────────────────────────────────────────────
            new TableRow({
              tableHeader: true,
              height: { value: 400, rule: "atLeast" },
              children: [
                hCell("Date Released",    COL_W[0]),
                hCell("Unit",             COL_W[1]),
                hCell("Name of Employee", COL_W[2]),
                hCell("Office",           COL_W[3]),
                hCell("Release Notes",  COL_W[4]),
              ],
            }),
            // ── Data rows ────────────────────────────────────────────────────
            ...chunk.map((r) =>
              new TableRow({
                children: [
                  dCell(fmtDate(r.date_released),                         COL_W[0], { center: true }),
                  dCell(r.unit_name,                                       COL_W[1], { bold: false, color: BRAND_HEX, center: true }),
                  dCell(r.collected_by,                                     COL_W[2], { center: true}),
                  dCell(deptDisplayMap[r.department_id ?? ""] ?? "—",      COL_W[3], { center: true}),
                  dCell(r.release_notes || "—",                        COL_W[4], {center: true}),
                ],
              })
            ),
          ],
        })
      );
    });
  }

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

  // ── Build & save ──────────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 600, right: 600, bottom: 600, left: 600 },
        },
      },
      children,
    }],
  });

  const buffer   = await Packer.toBlob(doc);
  const suffix   = monthFilter ? `_${monthFilter}` : `_${todayLong().replace(/\//g, "-")}`;
  const filename = `Outgoing_Units_Log${suffix}.docx`;
  saveAs(buffer, filename);
}