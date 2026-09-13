import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/server/context";
import { startTimer, stopTimer, getTimerStatus } from "@/server/services/timer";
import { TimerError } from "@/server/services/timer";
import { rateLimit } from "@/lib/rate-limit";

const tapSchema = z.object({
  cardId: z.string().min(1).max(20),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = tapSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const cardId = parsed.data.cardId.trim();

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rl = rateLimit({ key: `kiosk:${ip}:${cardId}`, max: 10, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const user = await db.user.findUnique({
      where: { nfcCardId: cardId },
      select: { id: true, name: true, active: true },
    });

    if (!user || !user.active) {
      return NextResponse.json({ error: "card_not_found" }, { status: 404 });
    }

    const status = await getTimerStatus(user.id);

    if (!status.active) {
      await startTimer(user.id);
      await audit({
        actorId: user.id,
        targetId: user.id,
        action: "kiosk.tap.start",
        entity: "TimerSession",
        entityId: user.id,
        payload: { cardId },
      });
      return NextResponse.json({
        action: "started",
        userName: user.name,
        todayWorkedMs: status.todayWorkedMs,
      });
    } else {
      const result = await stopTimer(user.id);
      await audit({
        actorId: user.id,
        targetId: user.id,
        action: "kiosk.tap.stop",
        entity: "TimeEntry",
        entityId: result.timeEntry.id,
        payload: { cardId, workedMinutes: result.workedMinutes },
      });
      return NextResponse.json({
        action: "stopped",
        userName: user.name,
        workedMinutes: result.workedMinutes,
        todayWorkedMs: await getTimerStatus(user.id).then((s) => s.todayWorkedMs),
      });
    }
  } catch (e) {
    if (e instanceof TimerError) {
      return NextResponse.json({ error: e.code }, { status: 409 });
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
