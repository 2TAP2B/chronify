import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { runYearSetup, getYearSetupStatus, YearSetupError } from "@/server/services/admin-year-setup";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const year = url.searchParams.get("year") ? Number(url.searchParams.get("year")) : new Date().getUTCFullYear() + 1;
    const status = await getYearSetupStatus({ actor: user, year });
    return NextResponse.json(status);
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof YearSetupError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const year = body?.year ? Number(body.year) : new Date().getUTCFullYear() + 1;
    const carriedOver = Boolean(body?.carriedOverFromPrev);
    const result = await runYearSetup({ actor: user, year, carriedOverFromPrev: carriedOver });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof YearSetupError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
