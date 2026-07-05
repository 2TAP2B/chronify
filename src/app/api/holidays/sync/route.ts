import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { syncHolidaysForState, syncAllUserStates, listHolidays } from "@/server/services/holidays";
import type { FederalState } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const state = (url.searchParams.get("state") ?? undefined) as FederalState | undefined;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const federalState = state ?? user.role === "ADMIN" ? (state ?? "DE_NW") : (user as { federalState?: FederalState }).federalState ?? "DE_NW";
    const holidays = await listHolidays({
      federalState,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return NextResponse.json({ holidays });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const year = body?.year ? Number(body.year) : new Date().getUTCFullYear();
    const state = body?.state as FederalState | undefined;
    const all = Boolean(body?.all);

    const results = all
      ? await syncAllUserStates(year)
      : [await syncHolidaysForState(year, state ?? "DE_NW")];

    return NextResponse.json({ results });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
