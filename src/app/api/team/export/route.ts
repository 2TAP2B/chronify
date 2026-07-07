import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { getTeamCalendar } from "@/server/services/team";
import { generateTeamPdf } from "@/server/services/team-pdf";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");

    if (!year || !month) {
      return NextResponse.json({ error: "year and month required" }, { status: 400 });
    }

    const { days, users } = await getTeamCalendar({
      actor: { id: user.id, role: user.role },
      year: Number(year),
      month: Number(month),
    });

    const buffer = await generateTeamPdf({
      days,
      users,
      year: Number(year),
      month: Number(month),
    });

    const y = String(year);
    const m = String(month).padStart(2, "0");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="team-plan-${y}-${m}.pdf"`,
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}