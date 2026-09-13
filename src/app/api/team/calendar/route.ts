import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { getTeamCalendar } from "@/server/services/team";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const year = url.searchParams.get("year")
      ? Number(url.searchParams.get("year"))
      : new Date().getUTCFullYear();
    const month = url.searchParams.get("month")
      ? Number(url.searchParams.get("month"))
      : new Date().getUTCMonth() + 1;
    const calendar = await getTeamCalendar({ actor: user, year, month });
    return NextResponse.json(calendar);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
