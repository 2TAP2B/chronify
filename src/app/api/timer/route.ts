import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { getTimerStatus, TimerError } from "@/server/services/timer";

export async function GET() {
  try {
    const user = await requireUser();
    const status = await getTimerStatus(user.id);
    return NextResponse.json(status);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
