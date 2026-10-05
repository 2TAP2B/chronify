import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { getTimerStatus } from "@/server/services/timer";

export async function GET(request: Request) {
  try {
    const actor = await requireUser();
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("userId");

    // Admin may inspect another user's timer state; everyone else sees only their own.
    const userId =
      targetUserId && targetUserId !== actor.id
        ? actor.role === "ADMIN"
          ? targetUserId
          : null
        : actor.id;
    if (!userId) {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }

    const status = await getTimerStatus(userId);
    return NextResponse.json(status);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
