import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { gatherReportData, toCsv, toExcel, toPdf } from "@/server/services/reports";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "csv";
    const fromStr = url.searchParams.get("from");
    const toStr = url.searchParams.get("to");
    const targetUserId = url.searchParams.get("userId") ?? undefined;

    if (!fromStr || !toStr) {
      return NextResponse.json({ error: "from and to required" }, { status: 400 });
    }
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    const data = await gatherReportData({ actor: user, targetUserId, from, to });

    if (format === "csv") {
      const csv = toCsv(data);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="stundenzettel-${data.range.from}_${data.range.to}.csv"`,
        },
      });
    }

    if (format === "excel") {
      const buf = toExcel(data);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="stundenzettel-${data.range.from}_${data.range.to}.xlsx"`,
        },
      });
    }

    if (format === "pdf") {
      const buf = await toPdf(data);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="stundenzettel-${data.range.from}_${data.range.to}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
