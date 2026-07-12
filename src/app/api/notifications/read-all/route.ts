import { NextResponse } from "next/server";
import { requireUser } from "@/server/context";
import { db } from "@/lib/db";

export async function POST() {
  try {
    const user = await requireUser();

    await db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}