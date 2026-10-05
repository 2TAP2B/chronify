import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/context";
import { remoteStartTimer, startTimer, TimerError } from "@/server/services/timer";

const startSchema = z
  .object({
    /** Admin only: start another user's timer. */
    userId: z.string().min(1).optional(),
    /** Admin only: backdated start time (must lie within the last 48h). */
    startAt: z.coerce.date().optional(),
  })
  .partial()
  .strict();

export async function POST(request: Request) {
  try {
    const actor = await requireUser();
    const body = await request.json().catch(() => null);

    // No body / empty body = plain self-start (employee flow unchanged).
    if (!body || (typeof body === "object" && Object.keys(body).length === 0)) {
      const session = await startTimer(actor.id);
      return NextResponse.json({ active: true, startedAt: session.startedAt.toISOString() });
    }

    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", code: "INVALID_INPUT" }, { status: 400 });
    }

    // Remote control (userId and/or backdated startAt) is admin-only.
    if (parsed.data.userId || parsed.data.startAt) {
      const session = await remoteStartTimer({
        actor,
        userId: parsed.data.userId ?? actor.id,
        startAt: parsed.data.startAt,
      });
      return NextResponse.json({ active: true, startedAt: session.startedAt.toISOString() });
    }

    const session = await startTimer(actor.id);
    return NextResponse.json({ active: true, startedAt: session.startedAt.toISOString() });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof TimerError) {
      const status = e.code === "FORBIDDEN" ? 403 : e.code === "NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
