import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Eye, Search, X, Clock, Loader,
  BadgeAlert, User, CheckCircle2, FileSpreadsheet, FileText, ChevronDown,
} from "lucide-react";
import { getSessionUserId } from "../../lib/audit-notifications";
import * as XLSX from "xlsx";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, ImageRun,
  PageOrientation, VerticalAlign,
} from "docx";
import { saveAs } from "file-saver";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

type TicketRow = {
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

type DeptMap = Record<string, string>;

const BRAND       = "#0a4c86";
const ORG_NAME    = "Tarlac City Government — IT Division";
const ORG_SUB     = "Information Technology Division";
const BRAND_HEX   = "0A4C86";
const ACCENT_HEX  = "1E3A5F";
const LIGHT_HEX   = "EBF2FA";
const TNR         = "Times New Roman";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric", month: "long", day: "numeric",
        timeZone: "Asia/Manila",
      })
    : "—";

const getMonthYear = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric", month: "long", timeZone: "Asia/Manila",
      })
    : "Unknown";

const monthSortKey = (m: string) =>
  m === "Unknown" ? 0 : new Date(m).getTime() || 0;

const todayLong = () =>
  new Date().toLocaleDateString("en-PH", {
    year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Manila",
  });

// ─── Excel export ─────────────────────────────────────────────────────────────
function exportToExcel(rows: TicketRow[], depts: DeptMap, selectedMonth: string) {
  const wb = XLSX.utils.book_new();

  const grouped: Record<string, TicketRow[]> = {};
  rows.forEach((r) => {
    const m = getMonthYear(r.completed_at);
    if (!grouped[m]) grouped[m] = [];
    grouped[m].push(r);
  });

  const months =
    selectedMonth === "All"
      ? Object.keys(grouped).sort((a, b) => monthSortKey(b) - monthSortKey(a))
      : [selectedMonth];

  // Shared styles
  const thinBorder = {
    top:    { style: "thin", color: { rgb: "CBD5E1" } },
    bottom: { style: "thin", color: { rgb: "CBD5E1" } },
    left:   { style: "thin", color: { rgb: "CBD5E1" } },
    right:  { style: "thin", color: { rgb: "CBD5E1" } },
  } as any;

  const fills = {
    white:  { patternType: "solid", fgColor: { rgb: "FFFFFF" } } as any,
    light:  { patternType: "solid", fgColor: { rgb: LIGHT_HEX } } as any,
    brand:  { patternType: "solid", fgColor: { rgb: BRAND_HEX } } as any,
    accent: { patternType: "solid", fgColor: { rgb: ACCENT_HEX } } as any,
    gray:   { patternType: "solid", fgColor: { rgb: "F8FAFC" } } as any,
  };

  const fonts = {
    orgName:    { bold: true,  color: { rgb: BRAND_HEX }, name: TNR, sz: 16 } as any,
    titleWhite: { bold: true,  color: { rgb: "FFFFFF" },  name: TNR, sz: 14 } as any,
    metaGray:   { bold: false, color: { rgb: "475569" },  name: TNR, sz: 10 } as any,
    metaBold:   { bold: true,  color: { rgb: BRAND_HEX }, name: TNR, sz: 10 } as any,
    colHeader:  { bold: true,  color: { rgb: "FFFFFF" },  name: TNR, sz: 11 } as any,
    dataNorm:   { bold: false, color: { rgb: "1F2937" },  name: TNR, sz: 10 } as any,
    dataBold:   { bold: true,  color: { rgb: BRAND_HEX }, name: TNR, sz: 10 } as any,
    dataGreen:  { bold: true,  color: { rgb: "059669" },  name: TNR, sz: 10 } as any,
    totalWhite: { bold: true,  color: { rgb: "FFFFFF" },  name: TNR, sz: 12 } as any,
  };

  const aligns = {
    center: { horizontal: "center", vertical: "center", wrapText: true } as any,
    left:   { horizontal: "left",   vertical: "center", wrapText: true } as any,
    right:  { horizontal: "right",  vertical: "center", wrapText: true } as any,
  };

  const cell = (v: any, font: any, fill: any, alignment: any, border?: any) => ({
    v, t: "s",
    s: { font, fill, alignment, border: border ?? thinBorder },
  });

  const empty = (fill: any) => cell("", fonts.dataNorm, fill, aligns.left, {
    top: { style: "none" }, bottom: { style: "none" },
    left: { style: "none" }, right: { style: "none" },
  });

  // ── Per-month sheets ──────────────────────────────────────────────────────
  months.forEach((month) => {
    const tickets = grouped[month] ?? [];
    const sheetName = month.replace(/[:\\\/\[\]\?\*]/g, "-").slice(0, 31);
    const aoa: any[][] = [];

    // Row 0: org name banner (merged A–J)
    aoa.push([
      cell(ORG_NAME, fonts.orgName, fills.white, aligns.center, {}),
      ...Array(9).fill(empty(fills.white)),
    ]);

    // Row 1: report title banner (merged A–J, brand bg)
    aoa.push([
      cell("RESOLVED TICKETS REPORT", fonts.titleWhite, fills.brand, aligns.center, {}),
      ...Array(9).fill(cell("", fonts.titleWhite, fills.brand, aligns.center, {})),
    ]);

    // Row 2: metadata row — period | total | generated date
    aoa.push([
      cell(`Period: ${month}`, fonts.metaGray, fills.light, aligns.left, {}),
      empty(fills.light),
      empty(fills.light),
      empty(fills.light),
      empty(fills.light),
      cell(`Total Resolved: ${tickets.length}`, fonts.metaBold, fills.light, aligns.center, {}),
      empty(fills.light),
      cell(`Generated: ${todayLong()}`, fonts.metaGray, fills.light, aligns.right, {}),
      empty(fills.light),
      empty(fills.light),
    ]);

    // Row 3: blank spacer
    aoa.push(Array(10).fill(empty(fills.white)));

    // Row 4: column headers
    const headers = [
      "Ticket ID", "Title", "Requester", "Office / Department",
      "Issue Type", "Description", "Action Taken",
      "Date Submitted", "Started", "Resolved On",
    ];
    aoa.push(headers.map((h) => cell(h, fonts.colHeader, fills.accent, aligns.center, thinBorder)));

    // Data rows
    tickets.forEach((r, i) => {
      const f = i % 2 === 0 ? fills.white : fills.light;
      aoa.push([
        cell(r.ticket_number?.trim() || `TKT-${r.id.slice(0, 8).toUpperCase()}`, fonts.dataBold,  f, aligns.center, thinBorder),
        cell(r.title,                       fonts.dataNorm,  f, aligns.left,   thinBorder),
        cell(r.employee_name,               fonts.dataNorm,  f, aligns.left,   thinBorder),
        cell(depts[r.department_id] ?? "—", fonts.dataNorm,  f, aligns.left,   thinBorder),
        cell(r.issue_type,                  fonts.dataNorm,  f, aligns.center, thinBorder),
        cell(r.description  || "—",         fonts.dataNorm,  f, aligns.left,   thinBorder),
        cell(r.action_taken || "—",         fonts.dataNorm,  f, aligns.left,   thinBorder),
        cell(fmtDate(r.date_submitted),     fonts.dataNorm,  f, aligns.center, thinBorder),
        cell(fmtDate(r.started_at),         fonts.dataNorm,  f, aligns.center, thinBorder),
        cell(fmtDate(r.completed_at),       fonts.dataGreen, f, aligns.center, thinBorder),
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, // org name
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, // title
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }, // period
      { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } }, // total
      { s: { r: 2, c: 7 }, e: { r: 2, c: 9 } }, // generated
      { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } }, // spacer
    ];

    ws["!rows"] = [
      { hpt: 30 }, // org name
      { hpt: 26 }, // title
      { hpt: 18 }, // meta
      { hpt: 6  }, // spacer
      { hpt: 22 }, // headers
      ...tickets.map(() => ({ hpt: 38 })),
    ];

    ws["!cols"] = [
      { wch: 16 }, { wch: 30 }, { wch: 22 }, { wch: 26 }, { wch: 20 },
      { wch: 36 }, { wch: 36 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // ── Summary sheet ──────────────────────────────────────────────────────────
  const fills2 = {
    white:  { patternType: "solid", fgColor: { rgb: "FFFFFF" } } as any,
    light:  { patternType: "solid", fgColor: { rgb: LIGHT_HEX } } as any,
    brand:  { patternType: "solid", fgColor: { rgb: BRAND_HEX } } as any,
    accent: { patternType: "solid", fgColor: { rgb: ACCENT_HEX } } as any,
  };

  const sc = (v: any, font: any, fill: any, align: any, border?: any) => ({
    v, t: "s", s: { font, fill, alignment: align, border: border ?? {} },
  });

  const thinB2 = {
    top:    { style: "thin", color: { rgb: "CBD5E1" } },
    bottom: { style: "thin", color: { rgb: "CBD5E1" } },
    left:   { style: "thin", color: { rgb: "CBD5E1" } },
    right:  { style: "thin", color: { rgb: "CBD5E1" } },
  } as any;

  const sumAoa: any[][] = [];
  sumAoa.push([
    sc(ORG_NAME, { bold: true, color: { rgb: BRAND_HEX }, name: TNR, sz: 16 }, fills2.white, { horizontal: "center", vertical: "center" }),
    sc("", {}, fills2.white, {}), sc("", {}, fills2.white, {}),
  ]);
  sumAoa.push([
    sc("MONTHLY SUMMARY — RESOLVED TICKETS", { bold: true, color: { rgb: "FFFFFF" }, name: TNR, sz: 13 }, fills2.brand, { horizontal: "center", vertical: "center" }),
    sc("", { bold: true, color: { rgb: "FFFFFF" }, name: TNR, sz: 13 }, fills2.brand, {}),
    sc("", { bold: true, color: { rgb: "FFFFFF" }, name: TNR, sz: 13 }, fills2.brand, {}),
  ]);
  sumAoa.push([
    sc(`Generated: ${todayLong()}`, { color: { rgb: "475569" }, name: TNR, sz: 10 }, fills2.light, { horizontal: "left", vertical: "center" }),
    sc("", {}, fills2.light, {}), sc("", {}, fills2.light, {}),
  ]);
  sumAoa.push([sc("", {}, fills2.white, {}), sc("", {}, fills2.white, {}), sc("", {}, fills2.white, {})]);

  sumAoa.push([
    sc("Month",   { bold: true, color: { rgb: "FFFFFF" }, name: TNR, sz: 11 }, fills2.accent, { horizontal: "center", vertical: "center" }, thinB2),
    sc("Total Resolved Tickets", { bold: true, color: { rgb: "FFFFFF" }, name: TNR, sz: 11 }, fills2.accent, { horizontal: "center", vertical: "center" }, thinB2),
    sc("Remarks", { bold: true, color: { rgb: "FFFFFF" }, name: TNR, sz: 11 }, fills2.accent, { horizontal: "center", vertical: "center" }, thinB2),
  ]);

  const allMonths = Object.keys(grouped).sort((a, b) => monthSortKey(b) - monthSortKey(a));
  allMonths.forEach((m, i) => {
    const f = i % 2 === 0 ? fills2.white : fills2.light;
    sumAoa.push([
      sc(m, { color: { rgb: "1F2937" }, name: TNR, sz: 11 }, f, { horizontal: "left", vertical: "center" }, thinB2),
      sc(grouped[m].length, { bold: true, color: { rgb: BRAND_HEX }, name: TNR, sz: 12 }, f, { horizontal: "center", vertical: "center" }, thinB2),
      sc("", { color: { rgb: "1F2937" }, name: TNR, sz: 11 }, f, { horizontal: "left", vertical: "center" }, thinB2),
    ]);
  });

  sumAoa.push([
    sc("TOTAL", { bold: true, color: { rgb: "FFFFFF" }, name: TNR, sz: 12 }, fills2.brand, { horizontal: "center", vertical: "center" }, thinB2),
    sc(rows.length, { bold: true, color: { rgb: "FFFFFF" }, name: TNR, sz: 14 }, fills2.brand, { horizontal: "center", vertical: "center" }, thinB2),
    sc("", {}, fills2.brand, {}, thinB2),
  ]);

  const sumWs = XLSX.utils.aoa_to_sheet(sumAoa);
  const totalIdx = sumAoa.length - 1;
  sumWs["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
    { s: { r: totalIdx, c: 0 }, e: { r: totalIdx, c: 0 } },
  ];
  sumWs["!rows"] = [
    { hpt: 28 }, { hpt: 24 }, { hpt: 18 }, { hpt: 6 }, { hpt: 22 },
    ...allMonths.map(() => ({ hpt: 20 })),
    { hpt: 24 },
  ];
  sumWs["!cols"] = [{ wch: 28 }, { wch: 26 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, sumWs, "Summary");

  const filename = `Resolved_Tickets_${selectedMonth === "All" ? "All_Months" : selectedMonth.replace(/ /g, "_")}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ─── Word export ──────────────────────────────────────────────────────────────
async function exportToWord(rows: TicketRow[], depts: DeptMap, selectedMonth: string) {
  const grouped: Record<string, TicketRow[]> = {};
  rows.forEach((r) => {
    const m = getMonthYear(r.completed_at);
    if (!grouped[m]) grouped[m] = [];
    grouped[m].push(r);
  });

  const months =
    selectedMonth === "All"
      ? Object.keys(grouped).sort((a, b) => monthSortKey(b) - monthSortKey(a))
      : [selectedMonth];

  // Fetch logo from public/
  let logoRun: ImageRun | null = null;
  try {
    const res  = await fetch(`${window.location.origin}/masaya-sa-tarlac-city.png`);
    const blob = await res.blob();
    const buf  = await blob.arrayBuffer();
    logoRun = new ImageRun({
      data: buf,
      transformation: { width: 170, height: 56 },
      type: "png",
    });
  } catch { logoRun = null; }

  // Border helpers
  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
  const allBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
  const noBorder   = {
    top:    { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left:   { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right:  { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  // Landscape content width: 15840 − 1080 − 1080 = 13680 DXA
  const TABLE_W   = 13680;
  const colWidths = [1520, 2300, 1720, 1900, 1560, 2400, 2280];

  const hCell = (text: string) =>
    new TableCell({
      borders: allBorders,
      width: { size: 0, type: WidthType.AUTO },
      shading: { fill: ACCENT_HEX, type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 80, bottom: 80, left: 110, right: 110 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, bold: true, size: 18, color: "FFFFFF", font: TNR })],
        }),
      ],
    });

  const dCell = (text: string, opts: { id?: boolean; resolved?: boolean; shade?: boolean } = {}) =>
    new TableCell({
      borders: allBorders,
      width: { size: 0, type: WidthType.AUTO },
      shading: {
        fill: opts.shade ? "EBF2FA" : "FFFFFF",
        type: ShadingType.CLEAR,
      },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 70, bottom: 70, left: 110, right: 110 },
      children: [
        new Paragraph({
          alignment: opts.id || opts.resolved ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [
            new TextRun({
              text,
              bold: opts.id || opts.resolved,
              size: 17,
              color: opts.resolved ? "059669" : opts.id ? BRAND_HEX : "374151",
              font: TNR,
            }),
          ],
        }),
      ],
    });

  const children: (Paragraph | Table)[] = [];

  // ── Branded header (logo + org name side by side) ─────────────────────────
  children.push(
    new Table({
      width: { size: TABLE_W, type: WidthType.DXA },
      columnWidths: [2000, TABLE_W - 2000],
      borders: {
        top:     { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom:  { style: BorderStyle.SINGLE, size: 10, color: BRAND_HEX },
        left:    { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right:   { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      },
      rows: [
        new TableRow({
          children: [
            // Logo cell
            new TableCell({
              borders: noBorder,
              width: { size: 2000, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 60, left: 0, right: 140 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: logoRun
                    ? [logoRun]
                    : [new TextRun({ text: "[Logo]", size: 20, italics: true, color: "94A3B8", font: TNR })],
                }),
              ],
            }),
            // Org name cell
            new TableCell({
              borders: noBorder,
              width: { size: TABLE_W - 2000, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 60, left: 140, right: 0 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Tarlac City Government", bold: true, size: 32, color: BRAND_HEX, font: TNR }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 40 },
                  children: [
                    new TextRun({ text: ORG_SUB, size: 20, color: "475569", font: TNR }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // ── Report title banner ───────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 220, after: 80 },
      shading: { fill: BRAND_HEX, type: ShadingType.CLEAR },
      children: [
        new TextRun({
          text: "   RESOLVED TICKETS REPORT   ",
          bold: true, size: 30, color: "FFFFFF", font: TNR,
        }),
      ],
    }),
    // Meta line
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 60 },
      children: [
        new TextRun({ text: `Period: ${selectedMonth === "All" ? "All Months" : selectedMonth}`, size: 19, color: "475569", font: TNR }),
        new TextRun({ text: "     •     ", size: 19, color: "CBD5E1", font: TNR }),
        new TextRun({ text: `Total Resolved: ${rows.length}`, bold: true, size: 19, color: BRAND_HEX, font: TNR }),
        new TextRun({ text: "     •     ", size: 19, color: "CBD5E1", font: TNR }),
        new TextRun({ text: `Generated: ${todayLong()}`, size: 19, color: "475569", font: TNR }),
      ],
    }),
    // Thin divider
    new Paragraph({
      spacing: { before: 60, after: 300 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0", space: 1 } },
      children: [],
    })
  );

  // ── Per-month ticket tables ───────────────────────────────────────────────
  months.forEach((month, mIdx) => {
    const tickets = grouped[month] ?? [];

    children.push(
      new Paragraph({
        spacing: { before: mIdx === 0 ? 0 : 440, after: 140 },
        children: [
          new TextRun({ text: "▌ ", size: 26, bold: true, color: BRAND_HEX, font: TNR }),
          new TextRun({ text: month, bold: true, size: 26, color: BRAND_HEX, font: TNR }),
          new TextRun({
            text: `  —  ${tickets.length} ticket${tickets.length !== 1 ? "s" : ""}`,
            size: 20, color: "64748B", font: TNR,
          }),
        ],
      })
    );

    if (tickets.length === 0) {
      children.push(
        new Paragraph({
          spacing: { after: 160 },
          children: [
            new TextRun({ text: "No resolved tickets for this period.", italics: true, size: 18, color: "9CA3AF", font: TNR }),
          ],
        })
      );
      return;
    }

    children.push(
      new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        columnWidths: colWidths,
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              hCell("Ticket ID"),
              hCell("Title"),
              hCell("Requester"),
              hCell("Department"),
              hCell("Issue Type"),
              hCell("Action Taken"),
              hCell("Resolved On"),
            ],
          }),
          ...tickets.map(
            (r, i) =>
              new TableRow({
                children: [
                  dCell(r.ticket_number?.trim() || `TKT-${r.id.slice(0, 8).toUpperCase()}`, { id: true, shade: i % 2 !== 0 }),
                  dCell(r.title,                       { shade: i % 2 !== 0 }),
                  dCell(r.employee_name,               { shade: i % 2 !== 0 }),
                  dCell(depts[r.department_id] ?? "—", { shade: i % 2 !== 0 }),
                  dCell(r.issue_type,                  { shade: i % 2 !== 0 }),
                  dCell(r.action_taken || "—",         { shade: i % 2 !== 0 }),
                  dCell(fmtDate(r.completed_at),       { resolved: true, shade: i % 2 !== 0 }),
                ],
              })
          ),
        ],
      })
    );
  });

  // ── Footer ────────────────────────────────────────────────────────────────
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
          text: `${ORG_NAME}  •  This document is system-generated and is for official use only.`,
          size: 16, italics: true, color: "94A3B8", font: TNR,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  const filename = `Resolved_Tickets_${
    selectedMonth === "All" ? "All_Months" : selectedMonth.replace(/ /g, "_")
  }.docx`;
  saveAs(buffer, filename);
}

// ─── WorkHistory Component ────────────────────────────────────────────────────
const WorkHistory: React.FC = () => {
  const userId   = getSessionUserId();
  const userRole = localStorage.getItem("session_user_role") || "";
  const isAdmin  = userRole === "Administrator";

  const [rows, setRows]                   = useState<TicketRow[]>([]);
  const [depts, setDepts]                 = useState<DeptMap>({});
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [selected, setSelected]           = useState<TicketRow | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting]         = useState<"excel" | "word" | null>(null);
  const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    let query = supabase
      .from("file_reports")
      .select("id, ticket_number, title, description, status, employee_name, department_id, issue_type, date_submitted, assigned_to, action_taken, started_at, completed_at")
      .eq("status", "Resolved")
      .order("completed_at", { ascending: false });

    if (!isAdmin) {
      if (!userId) { setRows([]); setLoading(false); return; }
      query = query.contains("assigned_to", [userId]);
    }

    const [{ data: tix, error }, { data: dlist }] = await Promise.all([
      query,
      supabase.from("departments").select("id, name"),
    ]);

    if (error) { showToast(error.message, "error"); setRows([]); }
    else setRows((tix ?? []).map((r: any) => ({
      ...r,
      assigned_to: Array.isArray(r.assigned_to) ? r.assigned_to : [],
    })));

    const dm: DeptMap = {};
    (dlist ?? []).forEach((d: any) => { dm[d.id] = d.name; });
    setDepts(dm);
    setLoading(false);
  };

  useEffect(() => { void fetchAll(); }, [userId, isAdmin]);

  useEffect(() => {
    const key = isAdmin ? "work_history_admin" : `work_history_${userId}`;
    const ch  = supabase.channel(key)
      .on("postgres_changes", { event: "*", schema: "public", table: "file_reports" }, () => void fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" },  () => void fetchAll())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId, isAdmin]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(getMonthYear(r.completed_at)));
    return ["All", ...Array.from(set).sort((a, b) => monthSortKey(b) - monthSortKey(a))];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchSearch = !q || [r.title, r.description, r.employee_name, r.ticket_number ?? "", r.issue_type]
        .join(" ").toLowerCase().includes(q);
      const matchMonth = selectedMonth === "All" || getMonthYear(r.completed_at) === selectedMonth;
      return matchSearch && matchMonth;
    });
  }, [rows, search, selectedMonth]);

  const exportRows = useMemo(() =>
    selectedMonth === "All" ? rows : rows.filter((r) => getMonthYear(r.completed_at) === selectedMonth),
    [rows, selectedMonth]
  );

  const handleExcelExport = () => {
    setExportMenuOpen(false);
    setExporting("excel");
    try {
      exportToExcel(exportRows, depts, selectedMonth);
      showToast("Excel file downloaded!", "success");
    } catch { showToast("Failed to export Excel.", "error"); }
    finally { setExporting(null); }
  };

  const handleWordExport = async () => {
    setExportMenuOpen(false);
    setExporting("word");
    try {
      await exportToWord(exportRows, depts, selectedMonth);
      showToast("Word document downloaded!", "success");
    } catch { showToast("Failed to export Word document.", "error"); }
    finally { setExporting(null); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8,
    border: "1px solid #e2e8f0", fontSize: 13,
    fontFamily: "'Poppins', sans-serif", background: "#f8fafc",
    boxSizing: "border-box",
  };

  if (!isAdmin && !userId)
    return <div style={{ padding: 24, color: "#94a3b8" }}>Session missing.</div>;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .wh-row:hover { background: #f0f7ff !important; }
        .wh-export-item:hover { background: #f1f5f9 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={{ fontFamily: "'Poppins', sans-serif", color: "#0f172a" }}>

        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", top: 20, right: 24, zIndex: 9999,
            padding: "0.65rem 1.1rem", borderRadius: 10, fontSize: 13,
            background: toast.type === "success" ? "#dcfce7" : "#fee2e2",
            color:      toast.type === "success" ? "#15803d" : "#b91c1c",
            border: `1px solid ${toast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          }}>{toast.msg}</div>
        )}

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8, letterSpacing: 1 }}>
              <CheckCircle2 size={20} color="#10b981" />
              {isAdmin ? "All Resolved Tickets" : "Work History"}
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
              {isAdmin
                ? "Complete record of all resolved tickets — export to Excel or Word by month."
                : "All tickets you have resolved — read-only record of completed work."}
            </p>
          </div>

          {/* Export button */}
          <div ref={exportRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={!!exporting}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "0.5rem 1rem", borderRadius: 10,
                border: `1px solid ${BRAND}`, background: BRAND,
                color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: exporting ? "not-allowed" : "pointer",
                fontFamily: "'Poppins', sans-serif",
                opacity: exporting ? 0.7 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {exporting
                ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} />
                : null}
              Export
              <ChevronDown size={14} />
            </button>

            {exportMenuOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0,
                background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                boxShadow: "0 8px 28px rgba(15,23,42,0.13)", zIndex: 200,
                minWidth: 218, overflow: "hidden",
              }}>
                <div style={{ padding: "0.5rem 1rem", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                  Scope: {selectedMonth === "All" ? "All months" : selectedMonth}
                </div>
                <button type="button" className="wh-export-item" onClick={handleExcelExport}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.75rem 1rem", background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'Poppins', sans-serif", color: "#0f172a", textAlign: "left" }}>
                  <FileSpreadsheet size={16} color="#16a34a" />
                  Export to Excel (.xlsx)
                </button>
                <div style={{ height: 1, background: "#f1f5f9" }} />
                <button type="button" className="wh-export-item" onClick={handleWordExport}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.75rem 1rem", background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'Poppins', sans-serif", color: "#0f172a", textAlign: "left" }}>
                  <FileText size={16} color="#2563eb" />
                  Export to Word (.docx)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", padding: "0.9rem 1rem", marginBottom: "1rem", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 360 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resolved tickets…" style={{ ...inputStyle, paddingLeft: 32 }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" }}>Month:</span>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ ...inputStyle, width: "auto", paddingRight: "1.5rem", cursor: "pointer" }}>
              {availableMonths.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", background: "#f1f5f9", padding: "4px 12px", borderRadius: 999, fontWeight: 600, whiteSpace: "nowrap" }}>
            {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e2e8f0", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["ID", "Title", "Requester", "Office", "Issue Type", "Resolved On", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "left", fontSize: 11, color: "#64748b", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                  <Loader size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Loading…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>No resolved tickets found.</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="wh-row" style={{ borderBottom: "1px solid #f1f5f9", background: "#fff" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: BRAND, whiteSpace: "nowrap" }}>
                      {r.ticket_number?.trim() || `TKT-${r.id.slice(0, 8).toUpperCase()}`}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", maxWidth: 200 }}>{r.title}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{r.employee_name}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: 12 }}>{depts[r.department_id] ?? "—"}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: 12, color: "#475569" }}>{r.issue_type}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#059669", fontWeight: 500, whiteSpace: "nowrap" }}>{fmtDate(r.completed_at)}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <button type="button" title="View" onClick={() => setSelected(r)}
                        style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Eye size={14} color={BRAND} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* View Modal */}
        {selected && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
            <div style={{ background: "#fff", borderRadius: 18, padding: "1.5rem", maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selected.title}</h3>
                <button type="button" onClick={() => setSelected(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ fontSize: 13, color: "#374151", display: "flex", flexDirection: "column", gap: 10 }}>
                <div><User size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />{selected.employee_name} · {depts[selected.department_id]}</div>
                <div><BadgeAlert size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />{selected.issue_type}</div>
                <div><Clock size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />Submitted: {fmtDate(selected.date_submitted)}</div>
                <div><CheckCircle2 size={12} color="#10b981" style={{ marginRight: 6, verticalAlign: "middle" }} />Resolved: {fmtDate(selected.completed_at)}</div>
                <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: 8, border: "1px solid #e2e8f0", whiteSpace: "pre-wrap" }}>{selected.description || "—"}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(16,185,129,0.10)", color: "#10b981" }}>✓ Resolved</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: BRAND, textTransform: "uppercase", marginTop: 4 }}>Action taken</div>
                <div style={{ fontSize: 13, background: "#f8fafc", padding: "0.75rem", borderRadius: 8, border: "1px solid #e2e8f0", whiteSpace: "pre-wrap" }}>{selected.action_taken || "—"}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default WorkHistory;