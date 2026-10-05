import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/server/context";
import {
  startTimer,
  stopTimer,
  startBreak,
  endBreak,
  getTimerStatus,
  TimerError,
} from "@/server/services/timer";

const actionSchema = z.object({
  cardId: z.string().min(1).max(20),
  action: z.enum(["identify", "start", "stop", "break", "endbreak"]).default("identify"),
});

// NOTE: intentionally no rate limiting here — the kiosk is a shared terminal
// where rapid consecutive taps (in/out) are the normal flow. Brute-force
// protection is not a meaningful threat: card IDs are physical NFC payloads,
// not user-chosen secrets (policy decision 2026-09, see issue #23).

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const cardId = parsed.data.cardId.trim();
    const action = parsed.data.action;

    const user = await db.user.findUnique({
      where: { nfcCardId: cardId },
      select: { id: true, name: true, firstName: true, active: true },
    });
    if (!user || !user.active) {
      return NextResponse.json({ error: "card_not_found" }, { status: 404 });
    }

    const buildResponse = (extra: Record<string, unknown> = {}) =>
      NextResponse.json({
        action,
        firstName: user.firstName ?? user.name.split(" ")[0] ?? "",
        userName: user.name,
        ...extra,
      });

    if (action === "identify") {
      return buildResponse({ status: await getTimerStatus(user.id) });
    }

    if (action === "start") {
      try {
        await startTimer(user.id);
      } catch (e) {
        // Double-tap instead of the error screen
        if (!(e instanceof TimerError && e.code === "ALREADY_RUNNING")) throw e;
      }
      await audit({
        actorId: user.id,
        targetId: user.id,
        action: "kiosk.timer.start",
        entity: "TimerSession",
        entityId: user.id,
        payload: { cardId },
      });
      return buildResponse({ status: await getTimerStatus(user.id) });
    }

    if (action === "stop") {
      const result = await stopTimer(user.id);
      await audit({
        actorId: user.id,
        targetId: user.id,
        action: "kiosk.timer.stop",
        entity: "TimeEntry",
        entityId: result.timeEntry.id,
        payload: { cardId, workedMinutes: result.workedMinutes },
      });
      return buildResponse({
        status: await getTimerStatus(user.id),
        workedMinutes: result.workedMinutes,
      });
    }

    if (action === "break" || action === "endbreak") {
      try {
        // Double-tap instead of the error screen (ALREADY on break / NOT on break)
        if (action === "break") await startBreak(user.id);
        else await endBreak(user.id);
      } catch (e) {
        if (!(
          e instanceof TimerError &&
          (e.code === "ALREADY_ON_BREAK" || e.code === "NOT_ON_BREAK")
        ))
          throw e;
      }
      await audit({
        actorId: user.id,
        targetId: user.id,
        action: action === "break" ? "kiosk.break.start" : "kiosk.break.end",
        entity: "TimerSession",
        entityId: user.id,
        payload: { cardId },
      });
      return buildResponse({ status: await getTimerStatus(user.id) });
    }

    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  } catch (e) {
    if (e instanceof TimerError) {
      return NextResponse.json({ error: e.code }, { status: 409 });
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
