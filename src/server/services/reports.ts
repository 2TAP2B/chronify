import { db } from "@/lib/db";
import { type SessionUser } from "@/server/context";
import { formatInZone } from "@/lib/datetime";
import { workedMsFromEntry } from "@/server/services/overtime";
import { msToSignedHours } from "@/lib/overtime/calculate";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";

export type ReportRow = {
  date: string;
  userName: string;
  type: string;
  startAt: string | null;
  endAt: string | null;
  breakMinutes: number;
  workedHours: number;
  note: string | null;
  source: string;
};

export async function gatherReportData(opts: {
  actor: SessionUser;
  targetUserId?: string;
  from: Date;
  to: Date;
}): Promise<{ rows: ReportRow[]; userName: string; range: { from: string; to: string } }> {
  const userId = opts.targetUserId ?? opts.actor.id;
  if (opts.targetUserId && opts.targetUserId !== opts.actor.id && opts.actor.role !== "ADMIN") {
    throw new Response("Forbidden", { status: 403 });
  }

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, timezone: true },
  });

  const entries = await db.timeEntry.findMany({
    where: {
      userId,
      date: { gte: opts.from, lte: opts.to },
    },
    orderBy: [{ date: "asc" }, { startAt: "asc" }],
    include: { user: { select: { name: true } } },
  });

  const rows: ReportRow[] = entries.map((e) => {
    const workedMs = workedMsFromEntry(e);
    return {
      date: formatInZone(e.date, user.timezone, "yyyy-MM-dd", "de"),
      userName: e.user.name,
      type: e.type,
      startAt: e.startAt ? formatInZone(e.startAt, user.timezone, "HH:mm", "de") : null,
      endAt: e.endAt ? formatInZone(e.endAt, user.timezone, "HH:mm", "de") : null,
      breakMinutes: e.breakMinutes,
      workedHours: Number(msToSignedHours(workedMs).toFixed(2)),
      note: e.note,
      source: e.source,
    };
  });

  return {
    rows,
    userName: user.name,
    range: {
      from: opts.from.toISOString().slice(0, 10),
      to: opts.to.toISOString().slice(0, 10),
    },
  };
}

export function toCsv(data: {
  rows: ReportRow[];
  userName: string;
  range: { from: string; to: string };
}): string {
  const fields = [
    "date",
    "userName",
    "type",
    "startAt",
    "endAt",
    "breakMinutes",
    "workedHours",
    "note",
    "source",
  ];
  return Papa.unparse({
    fields,
    data: data.rows.map((r) => [
      r.date,
      r.userName,
      r.type,
      r.startAt ?? "",
      r.endAt ?? "",
      r.breakMinutes,
      r.workedHours,
      r.note ?? "",
      r.source,
    ]),
  });
}

export function toExcel(data: {
  rows: ReportRow[];
  userName: string;
  range: { from: string; to: string };
}): Buffer {
  const wsData: (string | number)[][] = [
    [
      "Datum",
      "Mitarbeiter",
      "Typ",
      "Start",
      "Ende",
      "Pause (min)",
      "Gearbeitet (h)",
      "Notiz",
      "Quelle",
    ],
    ...data.rows.map((r) => [
      r.date,
      r.userName,
      r.type,
      r.startAt ?? "",
      r.endAt ?? "",
      r.breakMinutes,
      r.workedHours,
      r.note ?? "",
      r.source,
    ]),
  ];
  const totalHours = data.rows.reduce((s, r) => s + r.workedHours, 0);
  wsData.push(["", "", "", "", "", "Gesamt", totalHours.toFixed(2), "", ""]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 20 },
    { wch: 14 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 14 },
    { wch: 30 },
    { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stundenzettel");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}

/* ------------------------------------------------------------------ PDF ---- */

const INK = "#111827";
const SLATE = "#475569";
const LIGHT = "#f1f5f9";
const BORDER = "#cbd5e1";
const ACCENT = "#1d4ed8";

const reportPdfStyles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingHorizontal: 36,
    paddingBottom: 52,
    fontSize: 9,
    color: INK,
    fontFamily: "Helvetica",
  },
  headerBand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    backgroundColor: INK,
    color: "#ffffff",
    paddingHorizontal: 36,
    paddingTop: 18,
    paddingBottom: 16,
  },
  headerBrand: { fontSize: 12, fontWeight: "bold", letterSpacing: 1.2 },
  headerTitle: { fontSize: 18, fontWeight: "bold" },
  metaBlock: {
    marginTop: 16,
    marginBottom: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  metaItem: { width: "33.33%", lineHeight: 1.5 },
  metaLabel: { fontSize: 7, color: SLATE, textTransform: "uppercase", letterSpacing: 0.8 },
  metaValue: { fontSize: 10, fontWeight: "bold" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: LIGHT,
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 5,
    minHeight: 18,
  },
  tableRowZebra: { backgroundColor: "#f8fafc" },
  tableRowTotal: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderTopWidth: 2,
    borderTopColor: INK,
    paddingVertical: 7,
    fontWeight: "bold",
  },
  headerCell: { fontSize: 8, fontWeight: "bold", color: INK },
  bodyCell: { fontSize: 8, paddingRight: 8, lineHeight: 1.35 },
  totalCell: { fontSize: 9, fontWeight: "bold", paddingRight: 8 },
  footerBand: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: SLATE,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
});

const TYPE_LABELS: Record<string, string> = {
  WORK: "Arbeit",
  VACATION: "Urlaub",
  SICK: "Krank",
  PUBLIC_HOLIDAY: "Feiertag",
  PERSONAL: "Persönlich",
};

const COL_WIDTHS = {
  date: "16%",
  type: "12%",
  start: "10%",
  end: "10%",
  break: "8%",
  hours: "10%",
  note: "36%",
};

function formatPdfRow(row: ReportRow) {
  const timeValue = (v: string | null) => (v ? v.replace(/^0/, (m) => m) : "—");
  return [
    row.date,
    TYPE_LABELS[row.type] ?? row.type,
    row.startAt ? timeValue(row.startAt) : "—",
    row.endAt ? timeValue(row.endAt) : "—",
    row.breakMinutes > 0 ? String(row.breakMinutes) : "—",
    row.workedHours > 0 ? row.workedHours.toFixed(2) : "—",
    row.note ?? "—",
  ];
}

export async function toPdfExport(data: {
  rows: ReportRow[];
  userName: string;
  range: { from: string; to: string };
}): Promise<Buffer> {
  const totalHours = data.rows.reduce((s, r) => s + r.workedHours, 0);
  const settings = await db.orgSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const appName = settings.appName || "Chronify";
  const today = new Date().toISOString().slice(0, 10);

  const headerLabels = ["Datum", "Typ", "Start", "Ende", "Pause", "Std.", "Notiz"];
  const widths = [
    COL_WIDTHS.date,
    COL_WIDTHS.type,
    COL_WIDTHS.start,
    COL_WIDTHS.end,
    COL_WIDTHS.break,
    COL_WIDTHS.hours,
    COL_WIDTHS.note,
  ];

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: reportPdfStyles.page },
      // Title band
      React.createElement(
        View,
        { style: reportPdfStyles.headerBand, fixed: true },
        React.createElement(Text, { style: reportPdfStyles.headerTitle }, "Stundenzettel"),
        React.createElement(Text, { style: reportPdfStyles.headerBrand }, appName)
      ),
      // Meta block
      React.createElement(
        View,
        { style: reportPdfStyles.metaBlock },
        React.createElement(
          View,
          { style: reportPdfStyles.metaItem },
          React.createElement(Text, { style: reportPdfStyles.metaLabel }, "MITARBEITER"),
          React.createElement(Text, { style: reportPdfStyles.metaValue }, data.userName)
        ),
        React.createElement(
          View,
          { style: reportPdfStyles.metaItem },
          React.createElement(Text, { style: reportPdfStyles.metaLabel }, "ZEITRAUM"),
          React.createElement(
            Text,
            { style: reportPdfStyles.metaValue },
            `${data.range.from} – ${data.range.to}`
          )
        ),
        React.createElement(
          View,
          { style: reportPdfStyles.metaItem },
          React.createElement(Text, { style: reportPdfStyles.metaLabel }, "ERSTELLT AM"),
          React.createElement(Text, { style: reportPdfStyles.metaValue }, today)
        )
      ),
      // Table
      React.createElement(
        View,
        { style: { marginTop: 4 } },
        React.createElement(
          View,
          { style: reportPdfStyles.tableHeader, fixed: true },
          ...headerLabels.map((label, i) =>
            React.createElement(
              Text,
              { key: `h${i}`, style: [{ width: widths[i] }, reportPdfStyles.headerCell] },
              label
            )
          )
        ),
        ...data.rows.map((row, i) =>
          React.createElement(
            View,
            {
              key: `r${i}`,
              style:
                i % 2 === 1
                  ? [reportPdfStyles.tableRow, reportPdfStyles.tableRowZebra]
                  : reportPdfStyles.tableRow,
              wrap: false,
            },
            [
              row.date,
              TYPE_LABELS[row.type] ?? row.type,
              row.startAt ?? "—",
              row.endAt ?? "—",
              row.breakMinutes > 0 ? String(row.breakMinutes) : "—",
              row.workedHours > 0 ? row.workedHours.toFixed(2) : "—",
              row.note ?? "—",
            ].map((cell, j) =>
              React.createElement(
                Text,
                {
                  key: `c${j}`,
                  style: { width: widths[j], paddingRight: 8, fontSize: 8, lineHeight: 1.35 },
                },
                cell
              )
            )
          )
        ),
        React.createElement(
          View,
          { style: reportPdfStyles.tableRowTotal, wrap: false },
          React.createElement(
            Text,
            { style: { width: "70%", paddingLeft: 0, fontSize: 9, fontWeight: "bold" } },
            "Gesamt"
          ),
          React.createElement(
            Text,
            { style: { width: "20%", fontSize: 9, fontWeight: "bold" } },
            `${totalHours.toFixed(2)} h`
          )
        )
      ),
      // Footer
      React.createElement(
        Text,
        {
          style: reportPdfStyles.footerBand,
          fixed: true,
          render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Erstellt am ${today} · ${appName} · Seite ${pageNumber}/${totalPages}`,
        } as never,
        ""
      )
    )
  );

  return renderToBuffer(doc);
}

export const toPdf = toPdfExport;
