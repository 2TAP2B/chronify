import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { getOvertimeView } from "@/server/services/overtime";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("userId") ?? undefined;
    const year = url.searchParams.get("year") ? Number(url.searchParams.get("year")) : undefined;

    const view = await getOvertimeView({
      actor: user,
      targetUserId,
      year,
    });
    return NextResponse.json(view);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
