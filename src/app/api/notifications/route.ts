import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { db } from "@/lib/db";
import type { NotificationType } from "@prisma/client";

export async function GET() {
  try {
    const user = await requireUser();
    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.notification.count({
        where: { userId: user.id, readAt: null },
      }),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await db.notification.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json() as {
      type: NotificationType;
      title: string;
      body?: string;
      payload?: Record<string, unknown>;
    };

    if (body.type !== "GENERIC") {
      return NextResponse.json({ error: "Only GENERIC type allowed from client" }, { status: 400 });
    }

    const existing = await db.notification.findFirst({
      where: {
        userId: user.id,
        type: body.type,
        title: body.title,
        readAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ id: existing.id, duplicate: true });
    }

    const [n] = await db.notification.createManyAndReturn({
      data: {
        userId: user.id,
        type: body.type,
        title: body.title,
        body: body.body ?? null,
        payload: body.payload ? (body.payload as object) : undefined,
        channel: "APP",
      },
    });
    return NextResponse.json(n);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}