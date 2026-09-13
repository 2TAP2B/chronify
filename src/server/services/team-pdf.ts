import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { TeamCalendarDay } from "@/server/services/team";

const MONTH_NAMES_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 7, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  meta: { fontSize: 9, color: "#666", marginBottom: 2 },
  legend: { flexDirection: "row", gap: 8, marginBottom: 8, fontSize: 7 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 2 },
  legendBox: { width: 10, height: 10, borderRadius: 2 },
  table: { borderWidth: 0.5, borderColor: "#ccc", borderStyle: "solid" },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
  },
  nameHeader: {
    width: 80,
    padding: 3,
    fontFamily: "Helvetica-Bold",
    borderRightWidth: 0.5,
    borderRightColor: "#ccc",
  },
  dayHeader: {
    flex: 1,
    padding: 2,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    borderRightWidth: 0.3,
    borderRightColor: "#ddd",
  },
  row: { flexDirection: "row", borderBottomWidth: 0.3, borderBottomColor: "#eee" },
  nameCell: {
    width: 80,
    padding: 3,
    fontFamily: "Helvetica",
    borderRightWidth: 0.5,
    borderRightColor: "#ccc",
  },
  dayCell: {
    flex: 1,
    padding: 2,
    textAlign: "center",
    borderRightWidth: 0.3,
    borderRightColor: "#eee",
  },
  cellText: { fontSize: 6, fontWeight: "bold" },
  weekend: { backgroundColor: "#f0f0f0" },
  holiday: { backgroundColor: "#d1fae5" },
  closure: { backgroundColor: "#fef3c7" },
  vacation: { backgroundColor: "#dbeafe", color: "#1e40af" },
  sick: { backgroundColor: "#fee2e2", color: "#991b1b" },
  publicHoliday: { backgroundColor: "#d1fae5", color: "#065f46" },
  closureCell: { backgroundColor: "#fef3c7", color: "#92400e" },
});

function cellStyle(
  entry: { type: string } | null | undefined,
  isWeekend: boolean,
  isHoliday: boolean,
  isClosure: boolean
): any {
  const base = styles.dayCell;
  if (entry) {
    if (entry.type === "VACATION") return { ...base, ...styles.vacation };
    if (entry.type === "SICK") return { ...base, ...styles.sick };
    if (entry.type === "PUBLIC_HOLIDAY") return { ...base, ...styles.publicHoliday };
    if (entry.type === "CLOSURE") return { ...base, ...styles.closureCell };
  }
  if (isWeekend) return { ...base, ...styles.weekend };
  if (isClosure) return { ...base, ...styles.closure };
  if (isHoliday) return { ...base, ...styles.holiday };
  return base;
}

function cellLabel(entry: { type: string } | null | undefined): string {
  if (!entry) return "";
  if (entry.type === "VACATION") return "U";
  if (entry.type === "SICK") return "K";
  if (entry.type === "PUBLIC_HOLIDAY") return "F";
  if (entry.type === "CLOSURE") return "S";
  return "";
}

export async function generateTeamPdf(opts: {
  days: TeamCalendarDay[];
  users: { id: string; name: string }[];
  year: number;
  month: number;
}): Promise<Buffer> {
  const { days, users, year, month } = opts;
  const monthName = MONTH_NAMES_DE[month - 1];

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", orientation: "landscape", style: styles.page },
      React.createElement(Text, { style: styles.title }, `Team-Schichtplan — ${monthName} ${year}`),
      React.createElement(Text, { style: styles.meta }, `${users.length} Mitarbeiter`),
      // Legend
      React.createElement(
        View,
        { style: styles.legend },
        React.createElement(
          View,
          { style: styles.legendItem },
          React.createElement(View, { style: [styles.legendBox, styles.vacation] }),
          React.createElement(Text, null, "Urlaub (U)")
        ),
        React.createElement(
          View,
          { style: styles.legendItem },
          React.createElement(View, { style: [styles.legendBox, styles.sick] }),
          React.createElement(Text, null, "Krank (K)")
        ),
        React.createElement(
          View,
          { style: styles.legendItem },
          React.createElement(View, { style: [styles.legendBox, styles.publicHoliday] }),
          React.createElement(Text, null, "Feiertag (F)")
        ),
        React.createElement(
          View,
          { style: styles.legendItem },
          React.createElement(View, { style: [styles.legendBox, styles.closureCell] }),
          React.createElement(Text, null, "Schließtag (S)")
        ),
        React.createElement(
          View,
          { style: styles.legendItem },
          React.createElement(View, { style: [styles.legendBox, styles.weekend] }),
          React.createElement(Text, null, "Wochenende")
        )
      ),
      // Table
      React.createElement(
        View,
        { style: styles.table },
        // Header
        React.createElement(
          View,
          { style: styles.headerRow },
          React.createElement(Text, { style: styles.nameHeader }, "Mitarbeiter"),
          ...days.map((d) => {
            const dayNum = Number(d.date.slice(8, 10));
            const weekdayIdx = d.weekday === 0 ? 6 : d.weekday - 1;
            const headerStyle = d.isWeekend
              ? [styles.dayHeader, styles.weekend]
              : [styles.dayHeader];
            return React.createElement(
              Text,
              { key: d.date, style: headerStyle },
              `${WEEKDAY_SHORT[weekdayIdx]}\n${dayNum}`
            );
          })
        ),
        // User rows
        ...users.map((u) =>
          React.createElement(
            View,
            { key: u.id, style: styles.row, wrap: false },
            React.createElement(Text, { style: styles.nameCell }, u.name),
            ...days.map((d) => {
              const entry = d.entries.find((e) => e.userId === u.id);
              const cs = cellStyle(entry, d.isWeekend, d.isHoliday, d.isClosure);
              return React.createElement(
                Text,
                { key: d.date, style: { ...cs, ...styles.cellText } },
                cellLabel(entry)
              );
            })
          )
        )
      )
    )
  );

  const { renderToBuffer } = await import("@react-pdf/renderer");
  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}
