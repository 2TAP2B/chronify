import { db } from "@/lib/db";
import { type SessionUser } from "@/server/context";
import { formatInZone } from "@/lib/datetime";
import { workedMsFromEntry } from "@/server/services/overtime";
import { msToSignedHours } from "@/lib/overtime/calculate";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

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
    orderBy: { date: "asc" },
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

export function toCsv(data: { rows: ReportRow[]; userName: string; range: { from: string; to: string } }): string {
  const fields = ["date", "userName", "type", "startAt", "endAt", "breakMinutes", "workedHours", "note", "source"];
  return Papa.unparse({
    fields,
    data: data.rows.map((r) => [
      r.date, r.userName, r.type, r.startAt ?? "", r.endAt ?? "",
      r.breakMinutes, r.workedHours, r.note ?? "", r.source,
    ]),
  });
}

export function toExcel(data: { rows: ReportRow[]; userName: string; range: { from: string; to: string } }): Buffer {
  const wsData: (string | number)[][] = [
    ["Datum", "Mitarbeiter", "Typ", "Start", "Ende", "Pause (min)", "Gearbeitet (h)", "Notiz", "Quelle"],
    ...data.rows.map((r) => [
      r.date, r.userName, r.type, r.startAt ?? "", r.endAt ?? "",
      r.breakMinutes, r.workedHours, r.note ?? "", r.source,
    ]),
  ];
  const totalHours = data.rows.reduce((s, r) => s + r.workedHours, 0);
  wsData.push(["", "", "", "", "", "Gesamt", totalHours.toFixed(2), "", ""]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 8 }, { wch: 8 },
    { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stundenzettel");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}

const pdfStyles = StyleSheet.create({
  page: { padding: 30, fontSize: 10 },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  meta: { marginBottom: 4 },
  tableHeader: { flexDirection: "row", backgroundColor: "#e2e8f0", fontWeight: "bold" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #e2e8f0" },
  tableRowTotal: { flexDirection: "row", borderTop: "2px solid #000", fontWeight: "bold" },
  cell: { padding: 4, fontSize: 8 },
  cellDate: { padding: 4, fontSize: 8, width: "20%" },
  cellType: { padding: 4, fontSize: 8, width: "15%" },
  cellTime: { padding: 4, fontSize: 8, width: "10%" },
  cellBreak: { padding: 4, fontSize: 8, width: "10%" },
  cellHours: { padding: 4, fontSize: 8, width: "10%" },
  cellNote: { padding: 4, fontSize: 8, width: "25%" },
  cellHeader: { padding: 4, fontSize: 8, fontWeight: "bold" },
});

export async function toPdf(data: {
  rows: ReportRow[];
  userName: string;
  range: { from: string; to: string };
}): Promise<Buffer> {
  const totalHours = data.rows.reduce((s, r) => s + r.workedHours, 0);

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: pdfStyles.page },
      React.createElement(Text, { style: pdfStyles.title }, "Stundenzettel"),
      React.createElement(Text, { style: pdfStyles.meta }, `Mitarbeiter: ${data.userName}`),
      React.createElement(Text, { style: pdfStyles.meta }, `Zeitraum: ${data.range.from} – ${data.range.to}`),
      React.createElement(View, { style: { marginTop: 12 } },
        // Header
        React.createElement(View, { style: pdfStyles.tableHeader },
          ["Datum", "Typ", "Start", "Ende", "Pause", "Std.", "Notiz"].map((h, i) =>
            React.createElement(Text, { key: i, style: [pdfStyles.cellHeader, [
              pdfStyles.cellDate, pdfStyles.cellType, pdfStyles.cellTime, pdfStyles.cellTime,
              pdfStyles.cellBreak, pdfStyles.cellHours, pdfStyles.cellNote,
            ][i]] }, h)
          )
        ),
        // Data rows
        ...data.rows.map((r, i) =>
          React.createElement(View, { key: i, style: pdfStyles.tableRow, wrap: false },
            [r.date, r.type, r.startAt ?? "—", r.endAt ?? "—", String(r.breakMinutes), r.workedHours.toFixed(2), r.note ?? "—"].map((cell, j) =>
              React.createElement(Text, { key: j, style: [pdfStyles.cell, [
                pdfStyles.cellDate, pdfStyles.cellType, pdfStyles.cellTime, pdfStyles.cellTime,
                pdfStyles.cellBreak, pdfStyles.cellHours, pdfStyles.cellNote,
              ][j]] }, String(cell))
            )
          )
        ),
        // Total row
        React.createElement(View, { style: pdfStyles.tableRowTotal },
          ["Gesamt", "", "", "", "", totalHours.toFixed(2), ""].map((cell, j) =>
            React.createElement(Text, { key: j, style: [pdfStyles.cell, [
              pdfStyles.cellDate, pdfStyles.cellType, pdfStyles.cellTime, pdfStyles.cellTime,
              pdfStyles.cellBreak, pdfStyles.cellHours, pdfStyles.cellNote,
            ][j]] }, cell)
          )
        )
      )
    )
  );

  const { renderToBuffer } = await import("@react-pdf/renderer");
  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}
